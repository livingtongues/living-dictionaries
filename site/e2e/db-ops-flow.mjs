#!/usr/bin/env node
// Deep DB-operations regression for the per-dict write path: the DictLiveDb
// reactive store + audit auto-stamping enabler, the operations.ts (dbOperations)
// layer over $app/state, the phonetic mutate-then-save pilot, and the sync
// round-trip to the REAL server SQLite. Driven with puppeteer-core (browser-tools
// skill) against the running `pnpm dev` server (dev-only paths — dev_admin_level,
// dev-media — need DEV mode, so we do NOT boot a node build here).
//
//   pnpm -F site seed:achi-fixture        # restore the non-admin achi manager role
//   pnpm -F site test:db                  # against http://localhost:3041 (default)
//   BASE_URL=http://localhost:3041 pnpm -F site test:db
//
// Identity: logs in via the dev inline-OTP path as the seeded NON-admin
// `achi-manager@example.com` (can_edit from a real dictionary_roles row). Asserts
// the audit columns are stamped with that user's id (MOCK_USER_ID).
//
// Net-zero: every row it creates it deletes; the one e_ja phonetic edit is
// captured and restored — so achi stays the clean fixture and the script re-runs.
/* eslint-disable no-console, node/prefer-global/process, unicorn/prefer-dom-node-text-content -- node CLI: console is the output channel + process drives the exit code; innerText is right for asserting RENDERED text */

import process from 'node:process'
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'
import Database from 'better-sqlite3'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const dir = dirname(fileURLToPath(import.meta.url))
const site_dir = join(dir, '..')
const screenshot_dir = join(dir, 'screenshots')
const base = process.env.BASE_URL || 'http://localhost:3041'
const DICT = 'achi'
const MOCK_USER_ID = '00000000-0000-4000-8000-000000000001'
const MANAGER_EMAIL = 'achi-manager@example.com'
const server_db_path = join(site_dir, '.data', 'dictionaries', `${DICT}.db`)

let browser
let active_page
let shot_index = 0
let passes = 0

function step(msg) { passes += 1; console.log(`✓ ${msg}`) }
function assert(cond, msg) { if (!cond) throw new Error(`ASSERT FAILED: ${msg}`) }
const wait = ms => new Promise(r => setTimeout(r, ms))

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: site_dir, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`))))
  })
}

async function shot(page, name) {
  shot_index += 1
  await page.screenshot({ path: join(screenshot_dir, `db-${String(shot_index).padStart(2, '0')}-${name}.png`) }).catch(() => {})
}

// In-page: SQL against the browser's wa-sqlite achi.db via the cached DictConnection.
function dbq(page, sql, params = []) {
  return page.evaluate(async (sql, params) => {
    const conn = globalThis.__ld_dict_connections?.achi?.connection
    if (!conn) throw new Error('achi DictConnection not on globalThis yet')
    return await conn.query(sql, params)
  }, sql, params)
}

// In-page: call a DictLiveDb table method (insert/update/upsert/delete) → its result.
function livedb(page, table, method, arg) {
  return page.evaluate(async (table, method, arg) => {
    const db = globalThis.__ld_dict_connections?.achi?.dict_db
    if (!db) throw new Error('achi dict_db not on globalThis yet')
    return await db[table][method](arg)
  }, table, method, arg)
}

function syncNow(page) {
  return page.evaluate(async () => {
    const conn = globalThis.__ld_dict_connections?.achi?.connection
    if (conn) await conn.sync_now()
  })
}

function serverRow(table, id) {
  const db = new Database(server_db_path, { readonly: true })
  try { return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) } finally { db.close() }
}

// Self-heal: if a prior run crashed after auto-sync pushed a test row but before
// its net-zero cleanup, the server achi.db holds a ZZ-test leftover (count != 13).
// Purge directly from the server file so the fresh browser pulls a clean 13.
function purge_server_leftovers() {
  const db = new Database(server_db_path)
  db.pragma('busy_timeout = 5000')
  try {
    const entries = db.prepare("SELECT id FROM entries WHERE lexeme LIKE '%ZZ-test%'").all()
    const tags = db.prepare("SELECT id FROM tags WHERE name LIKE 'ZZ-test%'").all()
    for (const e of entries) {
      db.prepare('DELETE FROM entry_tags WHERE entry_id=?').run(e.id)
      db.prepare('DELETE FROM senses WHERE entry_id=?').run(e.id)
      db.prepare('DELETE FROM entries WHERE id=?').run(e.id)
    }
    for (const t of tags) {
      db.prepare('DELETE FROM entry_tags WHERE tag_id=?').run(t.id)
      db.prepare('DELETE FROM tags WHERE id=?').run(t.id)
    }
    if (entries.length || tags.length) console.log(`• purged ${entries.length} entry + ${tags.length} tag leftover(s) from server achi.db`)
  } finally { db.close() }
}

async function main() {
  await mkdir(screenshot_dir, { recursive: true })

  // Restore the non-admin achi manager role (idempotent; small shared.db upsert).
  console.log('• seeding achi-manager role…')
  await run('pnpm', ['seed:achi-fixture'])
  purge_server_leftovers()

  browser = await launch({ viewport: { width: 1200, height: 950 }, args: ['--lang=en-US'] })
  const page = await browser.newPage()
  active_page = page
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  const page_errors = []
  page.on('pageerror', e => page_errors.push(e.message))

  // Preflight: the target IS the Living dev server (not house on :5000).
  const res = await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' }).catch(() => null)
  const title = await page.title().catch(() => '')
  assert(res && res.status() < 500, `dev server not reachable at ${base} (start it: pnpm --filter=site dev)`)
  assert(!/House/i.test(title), `${base} is serving "${title}" — not Living. Is 3041 Living's dev server?`)
  step(`preflight: Living dev server reachable at ${base} (title="${title}")`)

  // ── G1: logged-out → entry read-only (no edit affordance) ──────────────────
  await page.goto(`${base}/${DICT}/entry/e_ja`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('water'), { timeout: 25000 })
  assert(!(await page.evaluate(() => document.body.innerText.includes('Add Audio'))), 'logged-out viewer must NOT see edit affordances')
  await shot(page, 'logged-out')
  step('G1 logged-out → entry read-only (no "Add Audio")')

  // ── login as the seeded NON-admin manager via dev inline-OTP ───────────────
  const login = await page.evaluate(async (email) => {
    const send = await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    const { code } = await send.json()
    const verify = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) })
    const me = await (await fetch('/api/auth/me')).json()
    return { verify_status: verify.status, me }
  }, MANAGER_EMAIL)
  assert(login.verify_status === 200, `OTP verify failed (${login.verify_status})`)
  assert(login.me?.email === MANAGER_EMAIL, 'logged-in user mismatch')
  assert(!login.me.is_admin && (login.me.admin_level === null || login.me.admin_level === undefined), `manager must be NON-admin (got is_admin=${login.me.is_admin} admin_level=${login.me.admin_level})`)
  step(`logged in as ${login.me.email} (non-admin manager — can_edit from a real role)`)

  // ── G2: manager → entries list (13) + can_edit on an entry ────────────────
  await page.goto(`${base}/${DICT}/entries`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('1-13 / 13'), { timeout: 25000 })
  assert(await page.evaluate(() => document.querySelectorAll('a[href*="/entry/"]').length) === 13, 'expected 13 entries')
  await page.goto(`${base}/${DICT}/entry/e_ja`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('Add Audio'), { timeout: 25000 })
  step('G2 manager → 13 entries; entry shows edit affordances (can_edit)')

  // ── B: audit auto-stamping via direct DictLiveDb calls (THE ENABLER) ───────
  const ins = await livedb(page, 'entries', 'insert', { lexeme: { default: 'ZZ-test-entry' } })
  assert(Array.isArray(ins) && ins[0]?.id, 'insert returned no row/id')
  const test_entry_id = ins[0].id
  let row = (await dbq(page, 'SELECT * FROM entries WHERE id = ?', [test_entry_id]))[0]
  assert(row.created_by_user_id === MOCK_USER_ID, `insert created_by not stamped (${row.created_by_user_id})`)
  assert(row.updated_by_user_id === MOCK_USER_ID, `insert updated_by not stamped (${row.updated_by_user_id})`)
  assert(row.dirty === 1 && row.created_at, 'insert dirty/created_at wrong')
  step(`B1 insert auto-stamped created_by/updated_by=MOCK_USER_ID, dirty=1, auto-uuid`)

  const before_updated_at = row.updated_at
  await livedb(page, 'entries', 'update', { id: test_entry_id, phonetic: 'ph-1' })
  row = (await dbq(page, 'SELECT * FROM entries WHERE id = ?', [test_entry_id]))[0]
  assert(row.phonetic === 'ph-1', 'update did not write phonetic')
  assert(row.updated_by_user_id === MOCK_USER_ID, 'update updated_by not stamped')
  assert(row.created_by_user_id === MOCK_USER_ID, 'update must not change created_by')
  assert(row.dirty === 1 && row.updated_at >= before_updated_at, 'update dirty/updated_at wrong')
  step('B2 update stamped updated_by, bumped updated_at, preserved created_by')

  await livedb(page, 'entries', 'upsert', { id: test_entry_id, lexeme: { default: 'ZZ-test-entry-2' } })
  row = (await dbq(page, 'SELECT * FROM entries WHERE id = ?', [test_entry_id]))[0]
  assert(JSON.parse(row.lexeme).default === 'ZZ-test-entry-2' && row.updated_by_user_id === MOCK_USER_ID, 'upsert wrong')
  step('B3 upsert stamped updated_by on conflict-update')

  const tagIns = await livedb(page, 'tags', 'insert', { name: 'ZZ-test-tag' })
  const test_tag_id = tagIns[0].id
  const jIns = await livedb(page, 'entry_tags', 'insert', { entry_id: test_entry_id, tag_id: test_tag_id })
  const jrow = (await dbq(page, 'SELECT * FROM entry_tags WHERE id = ?', [jIns[0].id]))[0]
  assert(jrow.created_by_user_id === MOCK_USER_ID && jrow.updated_by_user_id === MOCK_USER_ID && jrow.dirty === 1, 'junction audit/dirty wrong')
  step('B4 junction (entry_tags) insert stamped audit cols + dirty')

  // ── F: sync round-trip — dirty rows push to the REAL server SQLite ─────────
  // The per-write dirty===1 assertions above already proved writes mark dirty.
  // Here we force a push and poll the real server file until the row lands (the
  // engine auto-syncs concurrently, and the direct WAL read is eventually
  // consistent — so poll rather than assume one syncNow + one read).
  let srv
  for (let i = 0; i < 16 && !srv; i++) { await syncNow(page).catch(() => {}); await wait(500); srv = serverRow('entries', test_entry_id) }
  assert(srv, 'test entry did NOT reach server achi.db after sync')
  assert(String(srv.lexeme).includes('ZZ-test'), `server lexeme unexpected (${srv.lexeme})`)
  assert(srv.updated_by_user_id === MOCK_USER_ID, 'server row updated_by not stamped')
  const local_dirty = (await dbq(page, 'SELECT dirty FROM entries WHERE id = ?', [test_entry_id]))[0]
  assert(!local_dirty || !local_dirty.dirty, 'local dirty not cleared after sync')
  step('F sync → row persisted to REAL server achi.db with stamped editor; local dirty cleared by id')

  // ── net-zero cleanup of the test rows (keeps the list at 13 for section E) ──
  // The app deletes ENTRIES via soft-delete (`update({ deleted })`, code path
  // covered by B2 above); the `.delete()` tombstone path + its cross-client
  // sync/cascade timing is a separate concern out of this change's scope. So we
  // remove the test rows deterministically: purge the server file FIRST (so a
  // concurrent auto-sync pull can't re-add them), then direct local SQL.
  purge_server_leftovers()
  await page.evaluate(async (ids) => {
    const conn = globalThis.__ld_dict_connections.achi.connection
    await conn.execute('DELETE FROM entry_tags WHERE id = ?', [ids.j])
    await conn.execute('DELETE FROM tags WHERE id = ?', [ids.tag])
    await conn.execute('DELETE FROM entries WHERE id = ?', [ids.entry])
    globalThis.__ld_dict_connections.achi.dict_db.notify_table('entries')
  }, { j: jIns[0].id, tag: test_tag_id, entry: test_entry_id })
  assert((await dbq(page, 'SELECT count(*) c FROM entries WHERE id = ?', [test_entry_id]))[0].c === 0, 'test entry not removed locally')
  assert(!serverRow('entries', test_entry_id), 'test entry not removed from server')
  step('net-zero: test entry/tag/junction removed locally + from server (back to 13)')

  // ── D: phonetic mutate-then-save PILOT via the real UI (operations bypassed) ─
  const eja_before = (await dbq(page, 'SELECT phonetic FROM entries WHERE id = ?', ['e_ja']))[0].phonetic
  await page.evaluate(() => {
    const field = [...document.querySelectorAll('div,span,button')].find(el => el.textContent.trim().startsWith('Phonetic') && el.textContent.trim().length < 30)
    if (!field) throw new Error('phonetic field not found')
    field.click()
  })
  await page.waitForFunction(() => [...document.querySelectorAll('input[type=text]')].some(i => i.offsetParent !== null))
  await page.evaluate(() => {
    const input = [...document.querySelectorAll('input[type=text]')].find(i => i.offsetParent !== null)
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'PILOT-EDITED')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.evaluate(() => {
    const save = [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && b.textContent.trim() === 'Save')
    if (!save) throw new Error('Save button not found')
    save.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('PILOT-EDITED'), { timeout: 10000 })
  const eja = (await dbq(page, 'SELECT phonetic, updated_by_user_id FROM entries WHERE id = ?', ['e_ja']))[0]
  assert(eja.phonetic === 'PILOT-EDITED', 'pilot _save did not write phonetic to dict.db')
  assert(eja.updated_by_user_id === MOCK_USER_ID, 'pilot _save did not stamp updated_by on the live row (the enabler)')
  await shot(page, 'phonetic-pilot')
  step('D phonetic pilot: live-row mutate+_save wrote dict.db + stamped editor; UI reflects it')

  // ── C: operations.ts (dbOperations) over $app/state — add/delete sense via UI ─
  await page.evaluate(() => {
    const add = [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && b.innerHTML.includes('i-system-uicons-versions'))
    if (!add) throw new Error('Add Sense button not found')
    add.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('Sense 2'), { timeout: 10000 })
  assert((await dbq(page, 'SELECT count(*) c FROM senses WHERE entry_id = ? AND deleted IS NULL', ['e_ja']))[0].c >= 2, 'insert_sense (dbOperations) did not add a sense')
  await page.evaluate(() => {
    const dels = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null && b.innerHTML.includes('i-fa-solid-times'))
    dels[dels.length - 1].click()
  })
  await page.waitForFunction(() => !document.body.innerText.includes('Sense 2'), { timeout: 10000 })
  step('C dbOperations via $app/state OK at runtime (insert_sense + delete-sense round-trip)')

  // ── E: read-model rebuilds from dict.db — list back to 13 after the churn ──
  await page.goto(`${base}/${DICT}/entries`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('1-13 / 13'), { timeout: 25000 })
  step('E entries list re-renders exactly 13 (Orama read-model rebuilt from dict.db)')

  // ── reload persistence: pilot phonetic survived the server round-trip ──────
  // poll the real server file until auto-sync has pushed the pilot edit
  let eja_srv
  for (let i = 0; i < 20 && eja_srv?.phonetic !== 'PILOT-EDITED'; i++) { await wait(500); eja_srv = serverRow('entries', 'e_ja') }
  assert(eja_srv?.phonetic === 'PILOT-EDITED', 'pilot phonetic did not persist to server achi.db')
  await page.goto(`${base}/${DICT}/entry/e_ja`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('PILOT-EDITED'), { timeout: 25000 })
  step('reload → pilot phonetic persisted to REAL server SQLite + re-rendered from it')

  // ── restore e_ja phonetic (net-zero) ──────────────────────────────────────
  await page.evaluate(async (val) => {
    await globalThis.__ld_dict_connections.achi.dict_db.entries.update({ id: 'e_ja', phonetic: val })
  }, eja_before)
  await syncNow(page)
  const eja_restored = (await dbq(page, 'SELECT phonetic FROM entries WHERE id = ?', ['e_ja']))[0].phonetic
  assert(eja_restored === eja_before, `e_ja phonetic not restored (got ${eja_restored})`)
  step(`net-zero cleanup: e_ja phonetic restored to "${eja_before ?? '(empty)'}" — achi clean`)

  if (page_errors.length) throw new Error(`pageerror(s): ${page_errors.join(' | ')}`)
  step('no uncaught page errors during the flow')

  console.log(`\n✅ db-ops-flow PASS — ${passes} checks (enabler stamping · dbOperations/$app/state · phonetic pilot · sync→real SQLite · net-zero)`)
}

main()
  .catch(async (error) => {
    console.error(`\n❌ db-ops-flow FAIL — ${error.message}`)
    if (active_page) {
      try {
        const diag = await active_page.evaluate(() => ({ pathname: location.pathname, body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300) }))
        console.error('  diagnostics:', JSON.stringify(diag))
        await active_page.screenshot({ path: join(screenshot_dir, 'db-failure.png') }).catch(() => {})
      } catch {}
    }
    process.exitCode = 1
  })
  .finally(async () => { if (browser) await browser.close().catch(() => {}) })
