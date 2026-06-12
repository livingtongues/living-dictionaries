#!/usr/bin/env node
// M4 Phase B verification: the entries SEARCH WORKER is fed from the per-dictionary
// SQLite db (better-sqlite3) via /api/dictionaries/[id]/entries-data, not the M1 stub.
// Boots `node build`, hits the bundle endpoint + the torwali entries list/detail, asserts
// real migrated entries render + zero unexpected pageerrors, then tears down.
//
//   pnpm -F site build && node e2e/entries-sqlite.mjs
/* eslint-disable no-console, node/prefer-global/process, unicorn/prefer-dom-node-text-content -- node CLI */

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const dir = dirname(fileURLToPath(import.meta.url))
const site_dir = join(dir, '..')
const port = process.env.ENTRIES_PORT || '3097'
const base = process.env.BASE_URL || `http://localhost:${port}`
const DICT = process.env.DICT || 'torwali'

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

  // 1. Bundle endpoint → real per-dict SQLite content
  const res = await fetch(`${base}/api/dictionaries/${DICT}/entries-data`)
  const bundle = await res.json()
  console.log(`\n[API] /api/dictionaries/${DICT}/entries-data → entries=${bundle.entries?.length} senses=${bundle.senses?.length}`)
  check('entries bundle has many real rows', bundle.entries?.length > 100, `got ${bundle.entries?.length}`)
  check('senses bundle populated', bundle.senses?.length > 100, `got ${bundle.senses?.length}`)
  check('entry rows carry a parsed lexeme MultiString object', bundle.entries?.some(e => e.lexeme && typeof e.lexeme === 'object'), '')
  check('new-schema bookkeeping columns are stripped', bundle.entries?.every(e => !('dirty' in e) && !('created_by_user_id' in e)), '')

  // 2. Browser: entries list renders real entries (worker → endpoint → index)
  browser = await launch()
  const page = await browser.newPage()
  const errors = []
  const ignore = /mapbox|cache\.livingdictionaries|Error loading cached index|status of 403|identity provider|FedCM|GSI_LOGGER/i
  page.on('pageerror', err => { if (!ignore.test(err.message)) errors.push(err.message) })
  page.on('console', msg => { if (msg.type() === 'error' && !ignore.test(msg.text())) errors.push(`console: ${msg.text()}`) })

  console.log(`\n[route] /${DICT}/entries`)
  await page.goto(`${base}/${DICT}/entries`, { waitUntil: 'networkidle2' })
  // search index builds in a worker after load — give it a moment
  await new Promise(r => setTimeout(r, 4000))
  const entry_links = await page.evaluate(() => document.querySelectorAll('[href*="/entry/"], a[href*="/entries/"]').length)
  const body = await page.evaluate(() => document.body.innerText)
  console.log(`  entry links rendered: ${entry_links}`)
  const count_match = body.match(/(\d[\d,]*)\s*(?:entries|\/)/i)
  console.log(`  body count hint: ${count_match ? count_match[0] : 'n/a'}`)
  check('entries list rendered real entry links (> 5)', entry_links > 5, `got ${entry_links}`)
  check('page shows a large entry count (real torwali corpus)', /9,?\d{3}|[1-9]\d{3}/.test(body), '')

  console.log(`\n[pageerrors] ${errors.length}`)
  errors.forEach(e => console.log(`    ! ${e}`))
  check('zero unexpected pageerrors on entries route', errors.length === 0, '')

  if (failures.length) { console.log(`\n✗ ${failures.length} FAILED: ${failures.join(', ')}`); process.exitCode = 1 }
  else { console.log('\n✓ ALL ENTRIES CHECKS PASSED') }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(async () => { try { await browser?.close() } catch {} try { server?.kill() } catch {} })
