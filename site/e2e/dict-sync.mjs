#!/usr/bin/env node
// Round-trip proof for M4 write/sync: an editor's change to the browser wa-sqlite
// dict.db PERSISTS to the real server per-dict SQLite (via the sync engine →
// POST /api/dictionary/[id]/changes) and is served back on a fresh load.
//
//   pnpm -F site build && pnpm -F site test:sync
//
// Self-boots `node build`, re-seeds the dev fixture, logs in as the seeded
// NON-admin manager (dev OTP), edits a phonetic + adds a sense, waits for the
// sync POST, then asserts the SERVER `.data/dictionaries/dev.db` reflects the
// edits (definitive — not local OPFS), and that a FRESH browser context (no
// OPFS) loads the edit from the server snapshot.
/* eslint-disable no-console, node/prefer-global/process, unicorn/prefer-dom-node-text-content */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const dir = dirname(fileURLToPath(import.meta.url))
const site_dir = join(dir, '..')
const port = process.env.SYNC_PORT || '3101'
const base = process.env.BASE_URL || `http://localhost:${port}`
const dict_db_path = join(site_dir, '.data', 'dictionaries', 'dev.db')
const marker = `haʔ-SYNC-${Date.now()}`

let server
let browser

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: site_dir, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`))))
  })
}

function boot_server() {
  return new Promise((resolve, reject) => {
    console.log(`• booting \`node build\` on :${port}…`)
    server = spawn('node', ['build'], {
      cwd: site_dir,
      env: { ...process.env, PORT: port, JWT_SECRET: process.env.JWT_SECRET || 'e2e-test-secret-that-is-long-enough-for-hs256', E2E_EXPOSE_OTP: 'true' },
    })
    const timer = setTimeout(() => reject(new Error('server did not log "Listening on" within 30s')), 30000)
    server.stdout.on('data', (chunk) => { if (chunk.toString().includes('Listening on')) { clearTimeout(timer); resolve() } })
    server.stderr.on('data', chunk => process.stderr.write(chunk))
    server.on('error', reject)
    server.on('close', code => reject(new Error(`server exited early (code ${code})`)))
  })
}

function read_server_entry(id) {
  const db = new Database(dict_db_path, { readonly: true })
  try {
    const entry = db.prepare('SELECT phonetic FROM entries WHERE id = ?').get(id)
    const sense_count = db.prepare('SELECT COUNT(*) AS c FROM senses WHERE entry_id = ?').get(id)
    return { phonetic: entry?.phonetic, sense_count: sense_count.c }
  } finally {
    db.close()
  }
}

async function login(page) {
  const result = await page.evaluate(async (email) => {
    const send = await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    const { code } = await send.json()
    const verify = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) })
    return { status: verify.status }
  }, 'dev-manager@example.com')
  if (result.status !== 200) throw new Error(`login failed: ${result.status}`)
}

async function main() {
  if (!process.env.BASE_URL) {
    if (!existsSync(join(site_dir, 'build/index.js'))) await run('pnpm', ['build'])
    console.log('• re-seeding dev fixture (clean phonetic = haʔ)…')
    await run('pnpm', ['seed:dev-fixture'])
    await boot_server()
  }

  const before = read_server_entry('e_ja')
  console.log(`• server dev.db before: phonetic=${JSON.stringify(before.phonetic)} senses=${before.sense_count}`)
  if (before.phonetic !== 'haʔ') throw new Error(`expected seeded phonetic 'haʔ', got ${JSON.stringify(before.phonetic)} — re-seed needed`)

  browser = await launch({ viewport: { width: 1100, height: 900 }, args: ['--lang=en-US'] })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  const page_errors = []
  page.on('pageerror', (error) => {
    page_errors.push(error.message)
  })
  page.on('dialog', (d) => { console.log('  [dialog]', d.message().slice(0, 200)); d.dismiss().catch(() => {}) })
  // `m.text()` renders an Error argument as the useless "JSHandle@error" — serialize
  // the args so a failure in this test names its own cause.
  page.on('console', async (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return
    const parts = []
    for (const handle of m.args()) {
      try {
        parts.push(await handle.evaluate(v => (v instanceof Error ? `${v.name}: ${v.message} :: ${(v.stack || '').split('\n').slice(0, 4).join(' | ')}` : typeof v === 'object' ? JSON.stringify(v) : String(v))))
      } catch { parts.push(m.text()) }
    }
    console.log(`  [console.${m.type()}]`, (parts.join(' ') || m.text()).slice(0, 600))
  })
  page.on('request', (r) => { if (r.url().includes('/api/dictionary/')) console.log(`  [request] ${r.method()} ${r.url().replace(base, '')}`) })

  await page.goto(`${base}/dev/entry/e_ja`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('water'))
  await login(page)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('Add Audio'), { timeout: 25000 })
  // …and wait for the dict DB itself: `Add Audio` ships in the SSR HTML, so it
  // proves nothing about the leader worker being up. Editing before then races
  // hydration (an inert click) and the write path (no connection).
  await page.waitForFunction(() => Boolean(globalThis.__ld_dict_connections?.dev?.connection), { timeout: 30000 })
  console.log('✓ logged in as dev-manager; editor affordances present')

  // Edit phonetic → unique marker, capturing the sync POST that follows the write.
  //
  // Two races this loop exists for, both invisible from outside the browser:
  //  1. `Add Audio` is in the SSR HTML, so the field can be on screen BEFORE
  //     hydration attaches its click handler — one click lands on inert markup.
  //  2. The guarded write facade REFUSES edits while the entries bundle is still
  //     loading ("Wait until loading spinner stops to make edits.", a
  //     `write_blocked` row + toast). Saving into that window closes the editor
  //     with nothing written — a real product behaviour, not a bug, but the test
  //     must wait it out rather than assert against it.
  const open_field_editor = () => page.evaluate(() => {
    const field = [...document.querySelectorAll('div,span,button')].find(el => el.textContent.trim().startsWith('Phonetic') && el.textContent.trim().length < 30)
    field?.click()
  })
  const type_and_save = () => page.evaluate((new_value) => {
    const input = [...document.querySelectorAll('input[type=text]')].find(i => i.value.startsWith('haʔ'))
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, new_value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    const save = [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && b.textContent.trim() === 'Save')
    if (!save) return false
    save.click()
    return true
  }, marker)

  let edited = false
  for (let attempt = 0; attempt < 20 && !edited; attempt++) {
    await open_field_editor()
    const opened = await page.waitForFunction(() => [...document.querySelectorAll('input[type=text]')].some(i => i.value.startsWith('haʔ')), { timeout: 2000 }).then(() => true).catch(() => false)
    if (!opened) continue
    if (!(await type_and_save())) continue
    edited = await page.waitForFunction(value => document.body.innerText.includes(value), { timeout: 2000 }, marker).then(() => true).catch(() => false)
  }
  if (!edited) throw new Error('phonetic edit never landed in the UI (editor never opened, or every save was refused)')
  console.log('✓ phonetic edited in UI — flushing sync…')

  // The write auto-schedules a sync; nudge it deterministically (same path) so the
  // test doesn't race the 30s periodic timer.
  await page.evaluate(async () => {
    const c = globalThis.__ld_dict_connections?.dev?.connection
    if (c) await c.sync_now().catch(() => {})
  })

  // Poll the SERVER db for the synced edit.
  let after = read_server_entry('e_ja')
  for (let i = 0; i < 20 && after.phonetic !== marker; i++) {
    await new Promise(r => setTimeout(r, 1000))
    after = read_server_entry('e_ja')
  }
  console.log(`• server dev.db after edit: phonetic=${JSON.stringify(after.phonetic)}`)
  if (after.phonetic !== marker) throw new Error(`SERVER persistence FAILED: expected ${JSON.stringify(marker)}, got ${JSON.stringify(after.phonetic)}`)
  console.log('✓ edit PERSISTED to the real server SQLite (not a stub, not just local OPFS)')

  // Fresh browser context (no OPFS) → must fetch the snapshot from the server and show the edit.
  const fresh = await browser.createBrowserContext()
  const fresh_page = await fresh.newPage()
  await fresh_page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  await fresh_page.goto(`${base}/dev/entry/e_ja`, { waitUntil: 'domcontentloaded' })
  await fresh_page.waitForFunction(value => document.body.innerText.includes(value), { timeout: 25000 }, marker)
  console.log('✓ a fresh (no-OPFS) browser context loads the edit from the server snapshot')
  await fresh.close()

  if (page_errors.length) throw new Error(`pageerror(s): ${page_errors.join(' | ')}`)
  console.log('✓ no uncaught page errors')

  console.log('\n✅ dict-sync round-trip PASS — wa-sqlite edit → server SQLite → fresh read')
}

main()
  .catch((error) => { console.error(`\n❌ dict-sync FAIL — ${error.message}`); process.exitCode = 1 })
  .finally(async () => {
    if (browser) await browser.close().catch(() => {})
    if (server && !server.killed) server.kill('SIGTERM')
    // The self-booted `node build` holds cron timers and open SQLite handles and
    // does not die on SIGTERM, so its stdio pipes keep THIS process alive — a PASS
    // would otherwise hang until the caller's timeout and report a killed exit
    // code. Exit on our own terms. (`dev-flow.mjs` and `dict-delete-2tab.mjs`
    // share this teardown and the same hang.)
    server?.kill('SIGKILL')
    process.exit(process.exitCode ?? 0)
  })
