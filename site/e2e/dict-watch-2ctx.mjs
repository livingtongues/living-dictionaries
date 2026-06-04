#!/usr/bin/env node
// vps-migration M4 write/sync P4b — the watch-based Orama feed, REMOTE-PULL path.
//
// Proves Orama "watches" wa-sqlite for BOTH local edits AND remote sync-pulls via the SAME
// watermark-delta watcher (no `api.X` double-write). Two isolated browser contexts (separate OPFS):
//   • Context A — logged-in manager: edits a phonetic to a unique marker → save → sync_now (push).
//   • Context B — logged-OUT viewer (pull-only) already viewing the entry with the OLD value:
//     sync_now (pull) → the synced `entries` row lands in B's wa-sqlite → `tables_changed` broadcast
//     → B's orama-watcher re-indexes that one entry → B's entry view updates to the marker WITHOUT
//     a reload and WITHOUT any direct Orama write.
//
//   pnpm -F site build && pnpm -F site test:watch
//
/* eslint-disable no-console, node/prefer-global/process, unicorn/prefer-dom-node-text-content */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const dir = dirname(fileURLToPath(import.meta.url))
const site_dir = join(dir, '..')
const port = process.env.WATCH_PORT || '3107'
const base = process.env.BASE_URL || `http://localhost:${port}`
const marker = `haʔ-PULL-${Date.now()}`

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

function attach_error_capture(page, errors) {
  // Ignore the pre-existing SvelteKit service-worker registration 404 (see .issues/service-worker-404.md).
  page.on('pageerror', (error) => {
    if (/ServiceWorker|service-worker\.js/i.test(error.message)) return
    errors.push(error.message)
  })
}

async function login_manager(page) {
  const result = await page.evaluate(async (email) => {
    const send = await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    const { code } = await send.json()
    const verify = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) })
    return { status: verify.status }
  }, 'achi-manager@example.com')
  if (result.status !== 200) throw new Error(`login failed: ${result.status}`)
}

async function sync_now(page) {
  await page.evaluate(async () => {
    const c = globalThis.__ld_dict_connections?.achi?.connection
    if (c) await c.sync_now().catch(() => {})
  })
}

async function main() {
  if (!process.env.BASE_URL) {
    if (!existsSync(join(site_dir, 'build/index.js'))) await run('pnpm', ['build'])
    console.log('• re-seeding achi fixture (clean phonetic = haʔ)…')
    await run('pnpm', ['seed:achi-fixture'])
    await boot_server()
  }

  browser = await launch({ viewport: { width: 1100, height: 900 }, args: ['--lang=en-US'] })
  const errors_a = []
  const errors_b = []

  // ---- Context A: logged-in manager (editor) ----
  const ctx_a = await browser.createBrowserContext()
  const page_a = await ctx_a.newPage()
  await page_a.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  attach_error_capture(page_a, errors_a)
  await page_a.goto(`${base}/achi/entry/e_ja`, { waitUntil: 'domcontentloaded' })
  await page_a.waitForFunction(() => document.body.innerText.includes('water'))
  await login_manager(page_a)
  await page_a.reload({ waitUntil: 'domcontentloaded' })
  await page_a.waitForFunction(() => document.body.innerText.includes('Add Audio'), { timeout: 25000 })
  console.log('✓ context A: logged-in manager viewing e_ja (editable)')

  // ---- Context B: logged-OUT viewer (pull-only), already viewing the OLD value ----
  const ctx_b = await browser.createBrowserContext()
  const page_b = await ctx_b.newPage()
  await page_b.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  attach_error_capture(page_b, errors_b)
  await page_b.goto(`${base}/achi/entry/e_ja`, { waitUntil: 'domcontentloaded' })
  await page_b.waitForFunction(() => document.body.innerText.includes('water'), { timeout: 25000 })
  await page_b.waitForFunction(() => document.body.innerText.includes('haʔ') && !document.body.innerText.includes('Add Audio'))
  if (await page_b.evaluate(() => document.body.innerText.includes('Add Audio'))) throw new Error('context B should be a read-only viewer (saw Add Audio)')
  console.log('✓ context B: logged-out viewer (pull-only) showing the seeded phonetic [haʔ]')

  // ---- A edits the phonetic → marker, saves, pushes ----
  await page_a.evaluate(() => {
    const field = [...document.querySelectorAll('div,span,button')].find(el => el.textContent.trim().startsWith('Phonetic') && el.textContent.trim().length < 30)
    field.click()
  })
  await page_a.waitForFunction(() => [...document.querySelectorAll('input[type=text]')].some(i => i.value === 'haʔ'))
  await page_a.evaluate((new_value) => {
    const input = [...document.querySelectorAll('input[type=text]')].find(i => i.value === 'haʔ')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, new_value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, marker)
  await page_a.evaluate(() => {
    const save = [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && b.textContent.trim() === 'Save')
    save.click()
  })
  await page_a.waitForFunction(value => document.body.innerText.includes(value), {}, marker)
  await sync_now(page_a)
  console.log('✓ context A: edited phonetic (watcher reflected it locally) + pushed to server')

  // Sanity: B must NOT yet show the marker (no pull happened).
  if (await page_b.evaluate(value => document.body.innerText.includes(value), marker))
    throw new Error('context B already shows the marker before pulling — test would be meaningless')

  // ---- B pulls → its watcher should re-index the synced row (NO reload) ----
  await sync_now(page_b)
  await page_b.waitForFunction(value => document.body.innerText.includes(value), { timeout: 20000 }, marker)
  // Prove it was the watcher, not a navigation: the URL/title never changed and the original gloss survives.
  const still_same_view = await page_b.evaluate(() => location.pathname === '/achi/entry/e_ja' && document.body.innerText.includes('water'))
  if (!still_same_view) throw new Error('context B navigated/reloaded — the assertion no longer proves the watcher')
  console.log('✓ context B: sync pull → watcher re-indexed e_ja → marker shown WITHOUT reload')

  if (errors_a.length) throw new Error(`context A pageerror(s): ${errors_a.join(' | ')}`)
  if (errors_b.length) throw new Error(`context B pageerror(s): ${errors_b.join(' | ')}`)
  console.log('✓ no uncaught page errors in either context')

  console.log('\n✅ 2-context watcher PASS — remote sync-pull reindexed via the same watch path (no double-write)')
}

main()
  .catch((error) => { console.error(`\n❌ 2-context watcher FAIL — ${error.message}`); process.exitCode = 1 })
  .finally(async () => {
    if (browser) await browser.close().catch(() => {})
    if (server && !server.killed) server.kill('SIGTERM')
  })
