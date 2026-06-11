// OPFS write-amplification verification for LD's leader-worker dict DB.
//
// Proves the single-owner OPFS sync-access-handle VFS writes pages IN PLACE at
// ~1× — the property that makes the leader-worker port safe on LUKS+btrfs QLC,
// vs IndexedDB→LevelDB's documented 10× cold / 55× steady amplification (house
// measured those through IDBBatchAtomicVFS; LD's dict.db never used IndexedDB —
// it was MemoryVFS — so this bench verifies the NEW path is ~1×, it does not
// re-derive the IDB number). The VFS file itself (`worker/opfs-sah-vfs.js`) is
// copied verbatim from house, which benched it at ~1×.
//
// Both signals are read FROM THE BROWSER (file sizes), so they're immune to the
// machine's heavy background disk noise that makes /proc/diskstats useless here:
//
//   A. cold backfill — load /nukuoro: the leader worker fetches the snapshot and
//      writes it to OPFS. amp = OPFS file size ÷ snapshot bytes downloaded. ≈ 1×
//      means the snapshot lands 1:1 with no store amplification.
//   B. steady in-place edits — a held-SAH worker pre-sizes a file, then rewrites
//      a hot page region with flush()-per-txn (mirrors our VFS xSync on commit),
//      and reports getSize() before/after. final == presized ⇒ pure in-place
//      writes, zero store growth (the IndexedDB freeze cause was store growth).
//
// Gate: cold ≈ 1× AND steady file growth == 0.
// Run: node tools/bench/opfs-write-amplification.mjs   (dev server on :3041)

import { mkdirSync, rmSync } from 'node:fs'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = 'http://localhost:3041'
const DICT = 'nukuoro'
const PROFILE = '/home/jacob/.cache/ld-bench/opfs-profile'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const MB = n => `${(n / 1048576).toFixed(2)} MB`

const STEADY_TXNS = 80
const PAGES_PER_TXN = 4
const PAGE = 4096
const HOT_REGION_PAGES = 1000

rmSync(PROFILE, { recursive: true, force: true })
mkdirSync(PROFILE, { recursive: true })

async function opfs_file_size(page) {
  try {
    return await page.evaluate(async (dict_id) => {
      try {
        const root = await navigator.storage.getDirectory()
        const dir = await root.getDirectoryHandle('dictionaries')
        const fh = await dir.getFileHandle(`${dict_id}.db`)
        return (await fh.getFile()).size
      } catch { return 0 }
    }, DICT)
  } catch { return 0 }
}

const browser = await launch({ headless: true, args: [`--user-data-dir=${PROFILE}`] })
const page = await browser.newPage()
const logs = []
page.on('console', m => logs.push(m.text()))
page.on('workercreated', w => w.on('console', m => logs.push(m.text())))

// ---- Phase A: real cold backfill (snapshot → OPFS) ----
await page.goto(`${BASE}/${DICT}/entries`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
await sleep(1500)
let snapshot_size = 0
for (let i = 0; i < 40; i++) { snapshot_size = await opfs_file_size(page); if (snapshot_size > 1_000_000) break; await sleep(500) }
// snapshot bytes downloaded, read from the dict-instance lifecycle log
const fetch_log = logs.find(l => l.includes('fetched fresh snapshot')) || ''
const snapshot_bytes = Number((fetch_log.match(/\((\d+) bytes\)/) || [])[1] || 0)
const cold_amp = snapshot_bytes ? +(snapshot_size / snapshot_bytes).toFixed(3) : null

// ---- Phase B: steady in-place edits via a held sync-access-handle ----
// Start the worker + poll its result over SHORT CDP calls (one long evaluate
// trips puppeteer's protocolTimeout when btrfs fsyncs are slow).
await page.evaluate(({ TXNS, PAGES_PER_TXN, PAGE, HOT }) => {
  const src = `
    self.onmessage = async (e) => {
      const { TXNS, PAGES_PER_TXN, PAGE, HOT } = e.data
      try {
        const root = await navigator.storage.getDirectory()
        const dir = await root.getDirectoryHandle('ld-bench-opfs', { create: true })
        try { await dir.removeEntry('pages.db') } catch {}
        const fh = await dir.getFileHandle('pages.db', { create: true })
        const ah = await fh.createSyncAccessHandle()
        const buf = new Uint8Array(PAGE); for (let i = 0; i < PAGE; i++) buf[i] = i & 255
        for (let pgno = 0; pgno < HOT; pgno++) ah.write(buf, { at: pgno * PAGE })
        ah.flush()                       // one-time pre-size so steady writes are in-place
        const presized = ah.getSize()
        let page_no = 0
        for (let t = 0; t < TXNS; t++) {
          for (let p = 0; p < PAGES_PER_TXN; p++) {
            const b = buf.slice(); b[0] = (t + p) & 255
            ah.write(b, { at: (page_no++ % HOT) * PAGE })
          }
          ah.flush()                     // durable per "txn" — mirrors our VFS xSync
        }
        const final = ah.getSize()
        ah.close()
        self.postMessage({ ok: true, presized, final, logical: TXNS * PAGES_PER_TXN * PAGE })
      } catch (err) { self.postMessage({ ok: false, error: String(err) }) }
    }`
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
  const w = new Worker(url, { type: 'module' })
  globalThis.__bench = { done: false }
  w.onmessage = (e) => { w.terminate(); globalThis.__bench = { done: true, ...e.data } }
  w.postMessage({ TXNS, PAGES_PER_TXN, PAGE, HOT })
}, { TXNS: STEADY_TXNS, PAGES_PER_TXN, PAGE, HOT: HOT_REGION_PAGES })

let steady = { ok: false, error: 'worker did not finish' }
for (let i = 0; i < 90; i++) {
  const r = await page.evaluate(() => globalThis.__bench).catch(() => null)
  if (r?.done) { steady = r; break }
  await sleep(1000)
}

await browser.close()

const steady_growth = steady.ok ? steady.final - steady.presized : null

console.log('\n================ OPFS WRITE-AMPLIFICATION ================')
console.log(`A. cold backfill (real snapshot → OPFS):`)
console.log(`   snapshot downloaded ${MB(snapshot_bytes)} → OPFS file ${MB(snapshot_size)} → ${cold_amp}× store amplification`)
console.log(`\nB. steady in-place edits (${STEADY_TXNS} txns × ${PAGES_PER_TXN} pages = ${MB(STEADY_TXNS * PAGES_PER_TXN * PAGE)} logical, hot ${HOT_REGION_PAGES} pages):`)
if (steady.ok)
  console.log(`   file pre-sized ${MB(steady.presized)} → final ${MB(steady.final)} → grew ${MB(steady_growth)} (in-place ⇒ 0 store amplification)`)
else
  console.log(`   ERROR: ${steady.error}`)
console.log(`\nReference (house, through IDBBatchAtomicVFS): IndexedDB = 10× cold / 55× steady.`)

const pass = steady.ok && cold_amp !== null && cold_amp >= 0.97 && cold_amp <= 1.05 && steady_growth === 0
console.log(pass ? '\nGATE: PASS — snapshot lands 1:1 in OPFS, steady edits write in place (zero store growth).' : '\nGATE: FAIL')
process.exit(pass ? 0 : 1)
