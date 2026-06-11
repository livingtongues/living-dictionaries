// Self-heal + fallback e2e for the OPFS leader-worker dict DB.
//
//   A. R2-404 fallback: a dict with NO R2 snapshot (brand-new dict before the
//      cron's first build / dev-only dict) must still boot — empty OPFS DB,
//      migrations from scratch, sync backfills via /changes?since=null.
//   B. Corrupt-file self-heal: garbage in the OPFS file (crash mid-write under
//      journal_mode=MEMORY) must not brick the leader — delete + refetch
//      (here: 404 → empty + backfill again) and keep serving.
//
// Setup fabricates the condition: copies achi.db to a new id ("heal-e2e") that
// prod R2 has never seen, with `snapshot_uploaded_at` in the FUTURE so the
// local snapshot-builder sweep can never upload it to the prod bucket.
// Cleanup removes the catalog row + dict file. Net-zero on server data.
//
// Run: node tools/e2e/opfs-dict-heal.mjs   (dev server on :3041 required)

import { globSync, mkdirSync, rmSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const require = createRequire('/home/jacob/code/living-dictionaries/site/package.json')
const Database = require('better-sqlite3')

const BASE = 'http://localhost:3041'
// Unique per run: the dev server caches an open handle per dict id, so reusing
// an id would serve a stale (unlinked) inode + leave mismatched -wal sidecars.
const DICT = `heal-e2e-${Date.now()}`
const SOURCE_DICT = 'achi'
const DATA_DIR = '/home/jacob/code/living-dictionaries/site/.data'
const DICT_DB_PATH = `${DATA_DIR}/dictionaries/${DICT}.db`
const PROFILE = '/home/jacob/.cache/ld-e2e/heal-profile'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

// ---- setup: fabricate a dict that exists locally but 404s on R2 ----
async function setup_async() {
  cleanup_data()
  const source = new Database(`${DATA_DIR}/dictionaries/${SOURCE_DICT}.db`, { readonly: true })
  let entry_count = 0
  try {
    entry_count = source.prepare('SELECT COUNT(*) AS c FROM entries').get().c
    await source.backup(DICT_DB_PATH)
  } finally {
    source.close()
  }
  const copy = new Database(DICT_DB_PATH)
  try {
    copy.prepare(`UPDATE db_metadata SET value = ? WHERE key = 'dictionary_id'`).run(DICT)
  } finally {
    copy.close()
  }
  const shared = new Database(`${DATA_DIR}/shared.db`)
  try {
    shared.prepare(`DELETE FROM dictionaries WHERE id = ?`).run(DICT)
    // snapshot_uploaded_at in the FUTURE → the local R2 sweep
    // (updated_at > snapshot_uploaded_at) can never pick this row up.
    shared.prepare(
      `INSERT INTO dictionaries (id, url, name, public, entry_count, snapshot_uploaded_at)
       VALUES (?, ?, 'Heal E2E (throwaway)', 1, ?, '2030-01-01T00:00:00.000Z')`,
    ).run(DICT, DICT, entry_count)
  } finally {
    shared.close()
  }
  return entry_count
}

function cleanup_data() {
  try {
    const shared = new Database(`${DATA_DIR}/shared.db`)
    try { shared.prepare(`DELETE FROM dictionaries WHERE id LIKE 'heal-e2e-%'`).run() } finally { shared.close() }
  } catch { /* best-effort */ }
  for (const file of globSync(`${DATA_DIR}/dictionaries/heal-e2e-*.db*`)) {
    try { unlinkSync(file) } catch { /* absent */ }
  }
}

// ---- browser helpers (mirrors opfs-dict-smoke.mjs) ----
function rpc_in_page(page, payload, { timeout_ms = 30000 } = {}) {
  return page.evaluate(async ({ dict_id, payload, timeout_ms }) => {
    const channel = new BroadcastChannel(`ld-db-${dict_id}`)
    const client_id = `e2e-${Math.random().toString(36).slice(2)}`
    const deadline = Date.now() + timeout_ms
    try {
      await new Promise((resolve, reject) => {
        let ping_timer
        channel.onmessage = (event) => {
          if (event.data?.kind === 'ready') { clearInterval(ping_timer); resolve() }
        }
        channel.postMessage({ kind: 'ping' })
        ping_timer = setInterval(() => {
          if (Date.now() > deadline) { clearInterval(ping_timer); reject(new Error('no leader ready')) } else channel.postMessage({ kind: 'ping' })
        }, 500)
      })
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('rpc timeout')), Math.max(1000, deadline - Date.now()))
        channel.onmessage = (event) => {
          const message = event.data
          if (message?.kind === 'res' && message.client_id === client_id) {
            clearTimeout(timer)
            if (message.ok) resolve(message.result)
            else reject(new Error(`${message.error?.code}: ${message.error?.message}`))
          }
        }
        channel.postMessage({ kind: 'req', client_id, req_id: 1, payload })
      })
    } finally {
      channel.close()
    }
  }, { dict_id: DICT, payload, timeout_ms })
}

function attach_logs(page, sink) {
  page.on('console', msg => sink.push(msg.text()))
  page.on('workercreated', worker => worker.on('console', msg => sink.push(msg.text())))
}

async function open_dict_page(browser) {
  const page = await browser.newPage()
  const errors = []
  const worker_logs = []
  page.on('pageerror', err => errors.push(String(err?.message || err)))
  attach_logs(page, worker_logs)
  await page.goto(`${BASE}/${DICT}/entries`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
  return { page, errors, worker_logs }
}

async function wait_for_log(logs, needle, timeout_ms = 20000) {
  const deadline = Date.now() + timeout_ms
  while (Date.now() < deadline) {
    if (logs.some(l => l.includes(needle))) return true
    await sleep(400)
  }
  return logs.some(l => l.includes(needle))
}

// ════════════════════════════════════════════════════════════════════════════
const expected_entries = await setup_async()
console.log(`setup: ${DICT} fabricated from ${SOURCE_DICT} (${expected_entries} entries; no R2 snapshot)`)
rmSync(PROFILE, { recursive: true, force: true })
mkdirSync(PROFILE, { recursive: true })

try {
  // ---- A. R2-404 fallback (fresh profile, no OPFS file, no R2 snapshot) ----
  let browser = await launch({ headless: true, args: [`--user-data-dir=${PROFILE}`] })
  {
    const { page, errors, worker_logs } = await open_dict_page(browser)

    const fell_back = await wait_for_log(worker_logs, 'snapshot fetch failed — starting from an empty DB')
    check('A: worker fell back to an empty DB on snapshot 404', fell_back, worker_logs.filter(l => l.includes('dict-instance')).join(' / ').slice(0, 200))

    // The leader announces ready BEFORE the layout's boot sync finishes —
    // poll until the backfill lands.
    let count = 0
    for (let i = 0; i < 30 && count !== expected_entries; i++) {
      const rows = await rpc_in_page(page, { type: 'query', sql: 'SELECT COUNT(*) AS c FROM entries' })
      count = rows?.[0]?.c ?? 0
      if (count !== expected_entries) await sleep(1000)
    }
    check('A: sync backfilled all entries (pull-since-null)', count === expected_entries, `count=${count} expected=${expected_entries}`)

    const meta = await rpc_in_page(page, { type: 'query', sql: `SELECT value FROM db_metadata WHERE key = 'dictionary_id'` })
    check('A: db self-reports correct dictionary_id', meta?.[0]?.value === DICT, meta?.[0]?.value)

    check('A: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  }
  await browser.close()

  // ---- B. corrupt-file self-heal (same profile → OPFS file persisted) ----
  browser = await launch({ headless: true, args: [`--user-data-dir=${PROFILE}`] })
  {
    // Corrupt the persisted OPFS DB from a page that does NOT open the dict
    // (no leader yet → no held SAH → writable from the main thread).
    const prep = await browser.newPage()
    await prep.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
    const corrupted = await prep.evaluate(async (dict_id) => {
      try {
        const root = await navigator.storage.getDirectory()
        const dir = await root.getDirectoryHandle('dictionaries')
        const handle = await dir.getFileHandle(`${dict_id}.db`)
        const file = await handle.getFile()
        if (file.size === 0) return 'file empty — nothing to corrupt'
        const writable = await handle.createWritable({ keepExistingData: true })
        await writable.write({ type: 'write', position: 0, data: new Uint8Array(256).fill(0xAB) })
        await writable.close()
        return 'ok'
      } catch (err) {
        return `corruption failed: ${err.message}`
      }
    }, DICT)
    check('B: corrupted the OPFS file header', corrupted === 'ok', corrupted)
    await prep.close()

    const { page, errors, worker_logs } = await open_dict_page(browser)

    const healed = await wait_for_log(worker_logs, 'self-heal: local DB unopenable')
    check('B: worker logged the self-heal retry', healed, worker_logs.filter(l => l.includes('dict-instance')).join(' / ').slice(0, 240))

    let count = 0
    try {
      for (let i = 0; i < 30 && count !== expected_entries; i++) {
        const rows = await rpc_in_page(page, { type: 'query', sql: 'SELECT COUNT(*) AS c FROM entries' })
        count = rows?.[0]?.c ?? 0
        if (count !== expected_entries) await sleep(1000)
      }
    } catch (err) {
      console.log(`   RPC failed: ${err.message}\n   ── full worker logs ──`)
      for (const line of worker_logs) console.log(`   ${line.slice(0, 200)}`)
    }
    check('B: entries served after self-heal (delete → refetch → backfill)', count === expected_entries, `count=${count} expected=${expected_entries}`)

    check('B: no page errors after self-heal', errors.length === 0, errors.slice(0, 3).join(' | '))
  }
  await browser.close()
} finally {
  cleanup_data()
  console.log('cleanup: removed heal-e2e catalog row + dict file')
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS')
process.exit(failures.length ? 1 : 0)
