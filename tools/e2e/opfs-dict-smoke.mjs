// Smoke test for the OPFS leader-worker dict DB (anonymous viewer path).
//
//   1. Fresh profile → /nukuoro/entries → leader elected, snapshot fetched from
//      R2, OPFS file laid down, entries queryable over the real transport.
//   2. Reload → opens existing OPFS file, NO snapshot re-fetch (session persistence).
//   3. Browser restart (same profile) → opens existing OPFS file, NO re-fetch
//      (persistence across restart), entries still queryable.
//
// "fetched fresh" vs "opened existing" is read from the leader WORKER's console
// (a dedicated worker's network requests aren't visible to page.on('request')).
//
// Run: node tools/e2e/opfs-dict-smoke.mjs   (dev server on :3041 required)

import { mkdirSync, rmSync } from 'node:fs'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = 'http://localhost:3041'
const DICT = 'nukuoro'
const PROFILE = '/home/jacob/.cache/ld-e2e/smoke-profile'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

rmSync(PROFILE, { recursive: true, force: true })
mkdirSync(PROFILE, { recursive: true })

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

// Mirror transport.ts: ping until the leader announces `ready`, then RPC.
function rpc_in_page(page, payload, { timeout_ms = 30000 } = {}) {
  return page.evaluate(async ({ dict_id, payload, timeout_ms }) => {
    const channel = new BroadcastChannel(`ld-db-${dict_id}`)
    const client_id = `e2e-${Math.random().toString(36).slice(2)}`
    const deadline = Date.now() + timeout_ms
    try {
      // 1. Wait for a leader.
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
      // 2. Send the request.
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

async function held_leader_locks(page) {
  return page.evaluate(async () => {
    const { held = [] } = await navigator.locks.query()
    return held.map(lock => lock.name).filter(name => name?.startsWith('ld-db-'))
  })
}

async function opfs_file_info(page) {
  return page.evaluate(async (dict_id) => {
    try {
      const root = await navigator.storage.getDirectory()
      const dir = await root.getDirectoryHandle('dictionaries')
      const handle = await dir.getFileHandle(`${dict_id}.db`)
      const file = await handle.getFile()
      return { exists: true, size: file.size }
    } catch {
      return { exists: false, size: 0 }
    }
  }, DICT)
}

// Capture the leader worker's lifecycle logs. Puppeteer routes a dedicated
// worker's console to BOTH the worker target AND the page console depending on
// version, so drain both into one sink.
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

// Count only the DB leader dedicated worker — the page also runs a separate
// Orama search worker, which we must not mistake for a DB leader.
function db_worker_count(page) {
  return page.workers().filter(w => w.url().includes('leader-worker')).length
}

async function entry_row_count(page) {
  return page.evaluate(() => document.querySelectorAll('a[href*="/entry/"]').length)
}

async function wait_for_entry_rows(page, timeout_ms = 25000) {
  try {
    await page.waitForFunction(() => document.querySelectorAll('a[href*="/entry/"]').length > 0, { timeout: timeout_ms, polling: 500 })
  } catch { /* fall through — caller asserts the count */ }
  return entry_row_count(page)
}

const fetched_fresh = logs => logs.some(l => l.includes('fetched fresh snapshot'))
const opened_existing = logs => logs.some(l => l.includes('opening existing OPFS file'))

// ---- Stage 1: cold load (fresh profile) ----
let browser = await launch({ headless: true, args: [`--user-data-dir=${PROFILE}`] })
{
  const { page, errors, worker_logs } = await open_dict_page(browser)

  const count = await rpc_in_page(page, { type: 'query', sql: 'SELECT COUNT(*) AS c FROM entries' })
  check('entries queryable via transport RPC', count?.[0]?.c > 1000, `count=${count?.[0]?.c}`)

  const locks = await held_leader_locks(page)
  check('single leader lock held', locks.filter(l => l === `ld-db-${DICT}-leader`).length === 1, locks.join(','))

  const file = await opfs_file_info(page)
  check('OPFS dict file laid down', file.exists && file.size > 1_000_000, `size=${file.size}`)

  await sleep(500)
  check('worker logged a fresh snapshot fetch on cold load', fetched_fresh(worker_logs), worker_logs.join(' / ').slice(0, 200))

  const meta = await rpc_in_page(page, { type: 'query', sql: `SELECT value FROM db_metadata WHERE key = 'dictionary_id'` })
  check('db self-reports correct dictionary_id', meta?.[0]?.value === DICT, meta?.[0]?.value)

  const rows_rendered = await wait_for_entry_rows(page)
  check('entry list rendered from dict DB (Orama read-path parity)', rows_rendered > 0, `${rows_rendered} rows`)
  await page.screenshot({ path: '/tmp/ld-opfs-smoke-cold.png' })
  check('no page errors on cold load', errors.length === 0, errors.slice(0, 3).join(' | '))

  check('leader tab spawned exactly one worker', db_worker_count(page) === 1, `${db_worker_count(page)} db-workers`)

  // ---- Stage 2: a SECOND tab is a follower (no worker, reads via the leader) ----
  const { page: follower, errors: errf, worker_logs: logsf } = await open_dict_page(browser)
  const fcount = await rpc_in_page(follower, { type: 'query', sql: 'SELECT COUNT(*) AS c FROM entries' })
  check('follower tab reads via BroadcastChannel', fcount?.[0]?.c === 6613, `count=${fcount?.[0]?.c}`)
  check('follower tab spawned NO worker', db_worker_count(follower) === 0, `${db_worker_count(follower)} db-workers`)
  check('follower did not re-fetch the snapshot', !fetched_fresh(logsf), logsf.find(l => l.includes('fetched fresh')) || '')
  const frows = await wait_for_entry_rows(follower)
  check('follower entry list rendered', frows > 0, `${frows} rows`)
  check('no page errors in follower', errf.length === 0, errf.slice(0, 3).join(' | '))

  // ---- Stage 3: close the leader tab → follower promotes (leader hand-off) ----
  await page.close()
  await sleep(3500)
  check('former follower promoted to leader (spawned a worker)', db_worker_count(follower) === 1, `${db_worker_count(follower)} db-workers`)
  check('promoted leader opened existing OPFS file (no re-fetch)', opened_existing(logsf) && !fetched_fresh(logsf), logsf.filter(l => l.includes('dict-instance')).join(' / ').slice(0, 160))
  const after_handoff = await rpc_in_page(follower, { type: 'query', sql: 'SELECT COUNT(*) AS c FROM entries' })
  check('reads still work after hand-off', after_handoff?.[0]?.c === 6613, `count=${after_handoff?.[0]?.c}`)
}
await browser.close()

// ---- Stage 4: restart browser, same profile (OPFS persistence) ----
browser = await launch({ headless: true, args: [`--user-data-dir=${PROFILE}`] })
{
  const { page, errors, worker_logs } = await open_dict_page(browser)
  const count = await rpc_in_page(page, { type: 'query', sql: 'SELECT COUNT(*) AS c FROM entries' })
  check('entries queryable after restart (OPFS persisted)', count?.[0]?.c === 6613, `count=${count?.[0]?.c}`)
  await sleep(500)
  check('restart opened existing OPFS file (no re-fetch)', opened_existing(worker_logs) && !fetched_fresh(worker_logs), worker_logs.filter(l => l.includes('dict-instance')).join(' / ').slice(0, 160))
  check('no page errors after restart', errors.length === 0, errors.slice(0, 3).join(' | '))
}
await browser.close()

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS')
process.exit(failures.length ? 1 : 0)
