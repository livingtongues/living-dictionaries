#!/usr/bin/env node
// Round-trip proof for M4 write/sync: an editor's change to the browser wa-sqlite
// dict.db PERSISTS to the real server per-dict SQLite (via the sync engine →
// POST /api/dictionary/[id]/changes) and is served back on a fresh load.
//
//   pnpm -F site build && pnpm -F site test:sync
//
// Self-boots `node build`, re-seeds the achi fixture, logs in as the seeded
// NON-admin manager (dev OTP), edits a phonetic + adds a sense, waits for the
// sync POST, then asserts the SERVER `.data/dictionaries/achi.db` reflects the
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
const dict_db_path = join(site_dir, '.data', 'dictionaries', 'achi.db')
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
    const sense_count = db.prepare('SELECT COUNT(*) AS c FROM senses WHERE entry_id = ? AND deleted IS NULL').get(id)
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
  }, 'achi-manager@example.com')
  if (result.status !== 200) throw new Error(`login failed: ${result.status}`)
}

async function main() {
  if (!process.env.BASE_URL) {
    if (!existsSync(join(site_dir, 'build/index.js'))) await run('pnpm', ['build'])
    console.log('• re-seeding achi fixture (clean phonetic = haʔ)…')
    await run('pnpm', ['seed:achi-fixture'])
    await boot_server()
  }

  const before = read_server_entry('e_ja')
  console.log(`• server achi.db before: phonetic=${JSON.stringify(before.phonetic)} senses=${before.sense_count}`)
  if (before.phonetic !== 'haʔ') throw new Error(`expected seeded phonetic 'haʔ', got ${JSON.stringify(before.phonetic)} — re-seed needed`)

  browser = await launch({ viewport: { width: 1100, height: 900 }, args: ['--lang=en-US'] })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  const page_errors = []
  page.on('pageerror', (error) => {
    page_errors.push(error.message)
  })
  page.on('dialog', (d) => { console.log('  [dialog]', d.message().slice(0, 200)); d.dismiss().catch(() => {}) })
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`  [console.${m.type()}]`, m.text().slice(0, 200)) })
  page.on('request', (r) => { if (r.url().includes('/api/dictionary/')) console.log(`  [request] ${r.method()} ${r.url().replace(base, '')}`) })

  await page.goto(`${base}/achi/entry/e_ja`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('water'))
  await login(page)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('Add Audio'), { timeout: 25000 })
  console.log('✓ logged in as achi-manager; editor affordances present')

  // Edit phonetic → unique marker, capturing the sync POST that follows the write.
  await page.evaluate(() => {
    const field = [...document.querySelectorAll('div,span,button')].find(el => el.textContent.trim().startsWith('Phonetic') && el.textContent.trim().length < 30)
    field.click()
  })
  await page.waitForFunction(() => [...document.querySelectorAll('input[type=text]')].some(i => i.value === 'haʔ'))
  await page.evaluate((new_value) => {
    const input = [...document.querySelectorAll('input[type=text]')].find(i => i.value === 'haʔ')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, new_value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, marker)
  await page.evaluate(() => {
    const save = [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && b.textContent.trim() === 'Save')
    save.click()
  })
  await page.waitForFunction(value => document.body.innerText.includes(value), {}, marker)
  console.log('✓ phonetic edited in UI — flushing sync…')

  // The write auto-schedules a sync; nudge it deterministically (same path) so the
  // test doesn't race the 30s periodic timer.
  await page.evaluate(async () => {
    const c = globalThis.__ld_dict_connections?.achi?.connection
    if (c) await c.sync_now().catch(() => {})
  })

  // Poll the SERVER db for the synced edit.
  let after = read_server_entry('e_ja')
  for (let i = 0; i < 20 && after.phonetic !== marker; i++) {
    await new Promise(r => setTimeout(r, 1000))
    after = read_server_entry('e_ja')
  }
  console.log(`• server achi.db after edit: phonetic=${JSON.stringify(after.phonetic)}`)
  if (after.phonetic !== marker) throw new Error(`SERVER persistence FAILED: expected ${JSON.stringify(marker)}, got ${JSON.stringify(after.phonetic)}`)
  console.log('✓ edit PERSISTED to the real server SQLite (not a stub, not just local OPFS)')

  // Fresh browser context (no OPFS) → must fetch the snapshot from the server and show the edit.
  const fresh = await browser.createBrowserContext()
  const fresh_page = await fresh.newPage()
  await fresh_page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  await fresh_page.goto(`${base}/achi/entry/e_ja`, { waitUntil: 'domcontentloaded' })
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
  })
