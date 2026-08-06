#!/usr/bin/env node
// Acceptance test for the inline boot-error reporter in `src/app.html` — the only
// telemetry that exists before the app does.
//
//   pnpm -F site build && pnpm -F site test:boot
//
// The guard test (`src/lib/debug/boot-error-reporter.test.ts`) only reads the
// script's SOURCE; this proves the behaviour against a real production build by
// staging the two outage shapes and reading the rows out of that run's logs.db:
//   a. an `/_app/immutable/entry/*` chunk fails to load        → exactly 1 row
//   b. the shell's `__sveltekit_<hash>` global is undefined     → exactly 1 row
//   c. a healthy load                                           → 0 rows, and the
//      real reporter owns late faults once it sets the disarm flag
//
// BOTH failures arrive only as `unhandledrejection` (kit boots inside
// `import().then()`), which is why the reporter listens on both channels.
/* eslint-disable no-console */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import Database from 'better-sqlite3'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const port = process.env.P || '3121'
const base = `http://localhost:${port}`
const data_dir = '/tmp/ld-boot-e2e-data'
rmSync(data_dir, { recursive: true, force: true })
mkdirSync(data_dir, { recursive: true })

const server = spawn('node', ['build'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: port, DATA_DIR: data_dir, JWT_SECRET: 'boot-e2e-secret-long-enough-for-hs256', NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'inherit'],
})
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('server never listened')), 60000)
  server.stdout.on('data', c => { if (c.toString().includes('Listening on')) { clearTimeout(timer); resolve() } })
})
console.log('server up on', port)

function boot_rows() {
  const db = new Database(`${data_dir}/logs.db`, { readonly: true })
  try {
    return db.prepare(`SELECT message, level, app_version, url, context FROM client_logs WHERE message = 'boot_error'`).all()
  } catch { return [] } finally { db.close() }
}
function all_error_rows() {
  const db = new Database(`${data_dir}/logs.db`, { readonly: true })
  try {
    return db.prepare(`SELECT message, level FROM client_logs WHERE level IN ('error','unhandled_rejection')`).all()
  } catch { return [] } finally { db.close() }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await launch()
const results = []

// ── (a) entry chunk blocked ────────────────────────────────────────────────
{
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setRequestInterception(true)
  page.on('request', (r) => {
    if (r.url().includes('/_app/immutable/entry/')) r.abort().catch(() => {})
    else r.continue().catch(() => {})
  })
  const before = boot_rows().length
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(6000)
  await ctx.close()
  const rows = boot_rows().slice(before)
  results.push(['a. entry chunk blocked', rows])
}

// ── (b) shell's __sveltekit_<hash> global broken ───────────────────────────
{
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setRequestInterception(true)
  page.on('request', async (r) => {
    if (r.resourceType() !== 'document') { r.continue().catch(() => {}); return }
    try {
      const upstream = await fetch(r.url())
      let html = await upstream.text()
      // Rename ONLY the shell's definition, so the client bundle reads a global
      // nobody defined — the 2026-08-03 poly.education outage shape.
      // The shell DEFINES a bare global: `__sveltekit_<hash> = { … }`. Rename only
      // that definition so the client chunks read a global nobody defined — the
      // 2026-08-03 poly.education blank-page shape.
      html = html.replace(/__sveltekit_([a-z0-9]{4,}) = \{/g, '__sveltekit_brokenxx = {')
      r.respond({ status: 200, contentType: 'text/html', body: html }).catch(() => {})
    } catch { r.continue().catch(() => {}) }
  })
  const before = boot_rows().length
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(6000)
  await ctx.close()
  const rows = boot_rows().slice(before)
  results.push(['b. __sveltekit_<hash> global broken', rows])
}

// ── (c) healthy load → silent; real reporter owns late faults ──────────────
{
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  const before = boot_rows().length
  const errors_before = all_error_rows().length
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__boot_reporter_off === true, { timeout: 30000 })
  console.log('  disarm flag set after a healthy load ✅')
  await page.evaluate(() => {
    setTimeout(() => { throw new Error('late boot-e2e error') }, 0)
    setTimeout(() => { Promise.reject(new Error('late boot-e2e rejection')) }, 0)
  })
  await sleep(9000)
  await page.evaluate(() => globalThis.__ld_flush_logs?.()).catch(() => {})
  await sleep(3000)
  await ctx.close()
  results.push(['c. healthy load (expect ZERO)', boot_rows().slice(before)])
  results.push(['c2. real reporter rows for the late faults', all_error_rows().slice(errors_before)])
}

console.log('\n──── RESULTS ────')
for (const [label, rows] of results) {
  console.log(`\n${label}: ${rows.length} row(s)`)
  for (const row of rows) console.log('   ', JSON.stringify(row).slice(0, 400))
}
await browser.close()
server.kill('SIGKILL')
process.exit(0)
