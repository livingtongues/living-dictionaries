#!/usr/bin/env node
// Cross-tab HARD-DELETE search-index propagation (issue:
// .issues/cross-tab-local-delete-search-index.md).
//
// TWO TABS in ONE browser context (so they SHARE the dict SharedWorker + OPFS, unlike the
// two-CONTEXT remote-pull test). Tab A deletes an entry; Tab B — already showing the entries
// list, never reloaded, never sync_now'd — must drop that entry from its per-tab Orama index
// via the `rows_deleted` broadcast the worker re-emits for a local delete.
//
//   pnpm -F site build && pnpm -F site test:delete-2tab
//   BASE_URL=http://localhost:3041 pnpm -F site test:delete-2tab   # against a running server
//
/* eslint-disable no-console, node/prefer-global/process, unicorn/prefer-dom-node-text-content */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const dir = dirname(fileURLToPath(import.meta.url))
const site_dir = join(dir, '..')
const port = process.env.DELETE_PORT || '3109'
const provided_base = process.env.BASE_URL
const base = provided_base || `http://localhost:${port}`

let server
let browser
let page_a
let page_b
const errors_a = []
const errors_b = []

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

async function login_manager(page) {
  const result = await page.evaluate(async (email) => {
    const send = await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    const { code } = await send.json()
    const verify = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) })
    return { status: verify.status }
  }, 'achi-manager@example.com')
  if (result.status !== 200) throw new Error(`login failed: ${result.status}`)
}

async function main() {
  if (!provided_base) {
    // Always rebuild — this test exists to verify freshly-changed source in the prod bundle.
    await run('pnpm', ['build'])
    console.log('• seeding achi fixture (13 entries incl. e_ja = "water")…')
    await run('pnpm', ['seed:achi-fixture'])
    await boot_server()
  } else {
    console.log(`• using BASE_URL=${base} (not booting a server)`)
  }

  browser = await launch({ viewport: { width: 1100, height: 900 }, args: ['--lang=en-US'] })
  // ONE context, TWO pages → they share the dict SharedWorker + OPFS + the session cookie.
  // Count entry links — layout-independent (works even when the tab is backgrounded, unlike
  // `innerText`, which a non-foreground tab reports as empty).
  const ENTRY_LINKS = `[...document.querySelectorAll('a')].filter(a => a.href.includes('/entry/')).length`
  const HAS_EJA = `[...document.querySelectorAll('a')].some(a => a.href.includes('/entry/e_ja'))`

  const context = await browser.createBrowserContext()

  // ---- Tab A: log in as the seeded achi manager, open e_ja (editable). Done FIRST, while A is the
  // foreground tab, so its `innerText`-based render waits resolve. ----
  page_a = await context.newPage()
  await page_a.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  page_a.on('pageerror', e => errors_a.push(e.message))
  page_a.on('dialog', d => d.accept().catch(() => {})) // entry-delete fires a confirm()
  await page_a.goto(`${base}/achi/entry/e_ja`, { waitUntil: 'domcontentloaded' })
  await page_a.waitForFunction(() => document.body.innerText.includes('water'), { timeout: 60000 })
  await login_manager(page_a)
  await page_a.reload({ waitUntil: 'domcontentloaded' })
  await page_a.waitForFunction(() => document.body.innerText.includes('Add Audio'), { timeout: 45000 })
  console.log('✓ tab A: logged-in manager viewing e_ja (editable)')

  // ---- Tab B: a SECOND tab in the SAME context (shares cookie + SharedWorker). Opening it now
  // makes B foreground; assert via querySelector counts (layout-independent). ----
  page_b = await context.newPage()
  await page_b.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  page_b.on('pageerror', e => errors_b.push(e.message))
  await page_b.goto(`${base}/achi/entries`, { waitUntil: 'domcontentloaded' })
  await page_b.waitForFunction(`${ENTRY_LINKS} === 13`, { timeout: 60000 })
  if (!await page_b.evaluate(`${HAS_EJA}`)) throw new Error('tab B list missing e_ja before the delete')
  console.log('✓ tab B: entries list shows 13 entries incl. e_ja ("water")')

  // ---- Tab A (bring to front so the confirm() + click land): hard-delete the entry ----
  await page_a.bringToFront()
  await page_a.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && b.innerHTML.includes('fa-trash ml-1'))
    if (!btn) throw new Error('entry Delete button not found')
    btn.click()
  })
  console.log('✓ tab A: clicked Delete on e_ja')

  // ---- Tab B: WITHOUT reload / WITHOUT sync, the entry drops via the cross-tab broadcast ----
  // 15s window is well under the 30s sync interval, so success proves the broadcast path, not a pull.
  await page_b.bringToFront()
  await page_b.waitForFunction(`${ENTRY_LINKS} === 12`, { timeout: 15000 })
    .catch(() => { throw new Error('tab B entry count did not drop to 12 within 15s — cross-tab rows_deleted broadcast did not reach B') })
  const b_after = await page_b.evaluate(`({ gone: !(${HAS_EJA}), still_on_list: location.pathname === '/achi/entries', count: ${ENTRY_LINKS} })`)
  if (!b_after.gone) throw new Error('tab B still shows the e_ja link after delete')
  if (!b_after.still_on_list) throw new Error('tab B navigated/reloaded — assertion no longer proves the cross-tab broadcast')
  console.log(`✓ tab B: e_ja removed from the search index WITHOUT reload (${b_after.count} entries left)`)

  if (errors_a.length) throw new Error(`tab A pageerror(s): ${errors_a.join(' | ')}`)
  if (errors_b.length) throw new Error(`tab B pageerror(s): ${errors_b.join(' | ')}`)
  console.log('✓ no uncaught page errors in either tab')

  console.log('\n✅ cross-tab delete PASS — a local hard-delete in tab A dropped the entry from tab B’s search index live')
}

async function diag(label, page, errors) {
  if (!page) return
  try {
    const d = await page.evaluate(() => ({ url: location.pathname, body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300) }))
    console.error(`  ${label}: ${d.url} :: ${d.body}${errors.length ? ` :: pageerrors=${errors.join(' | ')}` : ''}`)
  } catch (err) { console.error(`  ${label}: <diag failed: ${err.message}>`) }
}

main()
  .catch(async (error) => {
    console.error(`\n❌ cross-tab delete FAIL — ${error.message}`)
    await diag('tab A', page_a, errors_a)
    await diag('tab B', page_b, errors_b)
    process.exitCode = 1
  })
  .finally(async () => {
    if (browser) await browser.close().catch(() => {})
    if (server && !server.killed) server.kill('SIGTERM')
  })
