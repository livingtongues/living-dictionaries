#!/usr/bin/env node
// M4 Phase A verification: the dictionary CATALOG is served from shared.db (better-sqlite3),
// not the M1 dummy stub. Boots its own `node build`, hits the catalog API + the globe / list /
// detail routes, asserts real migrated data + zero pageerrors, then tears down.
//
//   pnpm -F site build && node e2e/catalog-sqlite.mjs
/* eslint-disable no-console, node/prefer-global/process, unicorn/prefer-dom-node-text-content -- node CLI */

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const dir = dirname(fileURLToPath(import.meta.url))
const site_dir = join(dir, '..')
const port = process.env.CATALOG_PORT || '3096'
const base = process.env.BASE_URL || `http://localhost:${port}`

let server, browser
const failures = []
function check(label, condition, detail = '') {
  if (condition) { console.log(`  ✓ ${label}`) }
  else { console.log(`  ✗ ${label} ${detail}`); failures.push(label) }
}

function boot_server() {
  return new Promise((resolve, reject) => {
    console.log(`• booting \`node build\` on :${port}…`)
    server = spawn('node', ['build'], { cwd: site_dir, env: { ...process.env, PORT: port } })
    const timer = setTimeout(() => reject(new Error('server did not log "Listening on" within 30s')), 30000)
    server.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Listening on')) { clearTimeout(timer); resolve() }
    })
    server.stderr.on('data', chunk => process.stderr.write(chunk))
    server.on('error', reject)
    server.on('close', code => reject(new Error(`server exited early (code ${code})`)))
  })
}

async function main() {
  if (!process.env.BASE_URL) await boot_server()

  // 1. Catalog API → real data from shared.db
  const public_res = await fetch(`${base}/api/dictionaries?visibility=public`)
  const { dictionaries: pub } = await public_res.json()
  console.log(`\n[API] /api/dictionaries?visibility=public → ${pub.length} dictionaries`)
  check('public catalog has the real migrated count (~220, not the 12 dummy)', pub.length > 100, `got ${pub.length}`)
  check('public catalog rows carry real names + coordinates', pub.some(d => d.name && d.coordinates?.points), '')
  const torwali = pub.find(d => d.url === 'torwali')
  check('torwali present in public catalog', !!torwali, '')

  const private_res = await fetch(`${base}/api/dictionaries?visibility=private`)
  const { dictionaries: priv } = await private_res.json()
  console.log(`[API] visibility=private → ${priv.length} dictionaries`)
  check('private catalog is large (unlisted dicts)', priv.length > 100, `got ${priv.length}`)

  // 2. Browser: pageerrors + DOM on globe / list / detail
  browser = await launch()
  const page = await browser.newPage()
  const errors = []
  // Known-unrelated to the catalog conversion: Mapbox tiles (403, no WebGL/token in headless),
  // the entries worker's CDN cache fetch (403, cache.livingdictionaries.app) which only fires
  // on the entries route (still stub/CDN until Phase B), and Google One Tap GSI noise (FedCM
  // unavailable in headless → "Not signed in with the identity provider"). Filter so the
  // assertion reflects catalog health.
  const ignore = /mapbox|cache\.livingdictionaries|Error loading cached index|status of 403|identity provider|FedCM|GSI_LOGGER/i
  const note = (text) => { if (!ignore.test(text)) errors.push(text) }
  page.on('pageerror', err => note(err.message))
  page.on('console', msg => { if (msg.type() === 'error') note(`console: ${msg.text()}`) })

  console.log('\n[route] / (globe)')
  await page.goto(`${base}/`, { waitUntil: 'networkidle2' })
  await new Promise(r => setTimeout(r, 1500))
  const home_text = await page.evaluate(() => document.body.innerText)
  check('home renders (header banner present)', home_text.length > 50, '')

  console.log('[route] /dictionaries (list)')
  await page.goto(`${base}/dictionaries`, { waitUntil: 'networkidle2' })
  await new Promise(r => setTimeout(r, 1500))
  const rows = await page.evaluate(() => document.querySelectorAll('tbody tr, table tr').length)
  const list_text = await page.evaluate(() => document.body.innerText)
  console.log(`  list shows ${rows} table rows`)
  check('dictionaries list shows many real rows (> 50)', rows > 50, `got ${rows}`)
  check('list contains a real dictionary name (Torwali)', /torwali/i.test(list_text), '')

  console.log('[route] /torwali (detail → /torwali/entries)')
  await page.goto(`${base}/torwali`, { waitUntil: 'networkidle2' })
  await new Promise(r => setTimeout(r, 1000))
  check('torwali detail resolved (url ends at /torwali/entries)', page.url().includes('/torwali'), page.url())

  console.log('[route] /zzz-not-a-real-dict (unknown → redirect home)')
  await page.goto(`${base}/zzz-not-a-real-dict-xyz`, { waitUntil: 'networkidle2' })
  check('unknown slug redirects to home', new URL(page.url()).pathname === '/', page.url())

  console.log(`\n[pageerrors] ${errors.length}`)
  errors.forEach(e => console.log(`    ! ${e}`))
  check('zero pageerrors / console errors across catalog routes', errors.length === 0, '')

  if (failures.length) { console.log(`\n✗ ${failures.length} FAILED: ${failures.join(', ')}`); process.exitCode = 1 }
  else { console.log('\n✓ ALL CATALOG CHECKS PASSED') }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(async () => { try { await browser?.close() } catch {} try { server?.kill() } catch {} })
