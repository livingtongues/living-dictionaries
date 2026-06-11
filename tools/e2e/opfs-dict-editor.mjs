// Editor-path e2e for the OPFS leader-worker dict DB (decision 5, capability 3):
// editor write + op-mutex + cross-tab reactivity + sync push, against the LOCAL
// VPS endpoints (the editor snapshot `/api/dictionary/[id]/db` + push `/changes`).
//
//   1. Login (dev OTP) + dev_admin_level=2 cookie → site admin → editor on any dict.
//   2. Tab A loads /nukuoro → editor leader (snapshot from the local VPS endpoint,
//      which the port also fixed to ship a rollback-journal header).
//   3. Tab A writes an entry (UPDATE … phonetic=marker, dirty=1) via the transport
//      exec — same shape DictLiveDb#update emits.
//   4. Write persists in OPFS (re-query returns the marker).
//   5. A follower tab B receives the tables_changed broadcast AND reads the marker
//      from the shared leader DB (cross-tab reactivity).
//   6. sync_now pushes to the local /changes endpoint → the row's dirty clears
//      (cleared by pushed id) → editor push verified end-to-end.
//
// Run: node tools/e2e/opfs-dict-editor.mjs   (dev server on :3041 required)

import { mkdirSync, rmSync } from 'node:fs'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = 'http://localhost:3041'
const DICT = 'nukuoro'
const EMAIL = 'jwrunner7@gmail.com'
const PROFILE = '/home/jacob/.cache/ld-e2e/editor-profile'
const sleep = ms => new Promise(r => setTimeout(r, ms))

rmSync(PROFILE, { recursive: true, force: true })
mkdirSync(PROFILE, { recursive: true })

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

function rpc_in_page(page, payload, { timeout_ms = 30000 } = {}) {
  return page.evaluate(async ({ dict_id, payload, timeout_ms }) => {
    const channel = new BroadcastChannel(`ld-db-${dict_id}`)
    const client_id = `e2e-${Math.random().toString(36).slice(2)}`
    const deadline = Date.now() + timeout_ms
    try {
      await new Promise((resolve, reject) => {
        let t
        channel.onmessage = (e) => { if (e.data?.kind === 'ready') { clearInterval(t); resolve() } }
        channel.postMessage({ kind: 'ping' })
        t = setInterval(() => { if (Date.now() > deadline) { clearInterval(t); reject(new Error('no leader ready')) } else channel.postMessage({ kind: 'ping' }) }, 500)
      })
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('rpc timeout')), Math.max(1000, deadline - Date.now()))
        channel.onmessage = (e) => {
          const m = e.data
          if (m?.kind === 'res' && m.client_id === client_id) {
            clearTimeout(timer)
            m.ok ? resolve(m.result) : reject(new Error(`${m.error?.code}: ${m.error?.message}`))
          }
        }
        channel.postMessage({ kind: 'req', client_id, req_id: 1, payload })
      })
    } finally { channel.close() }
  }, { dict_id: DICT, payload, timeout_ms })
}

// In a follower tab, record tables_changed broadcasts seen on the channel.
async function start_broadcast_recorder(page) {
  await page.evaluate((dict_id) => {
    globalThis.__events = []
    const channel = new BroadcastChannel(`ld-db-${dict_id}`)
    channel.onmessage = (e) => { if (e.data?.kind === 'event') globalThis.__events.push(e.data.event) }
    globalThis.__events_channel = channel
  }, DICT)
}
const read_events = page => page.evaluate(() => globalThis.__events || [])

const browser = await launch({ headless: true, args: [`--user-data-dir=${PROFILE}`] })

// ---- Login + dev admin cookie ----
const login_page = await browser.newPage()
await login_page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
const login = await login_page.evaluate(async (email) => {
  const j = async r => ({ status: r.status, body: await r.json().catch(() => null) })
  const send = await j(await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) }))
  if (send.status !== 200 || !send.body?.code) return { ok: false, step: 'send-code', send }
  const verify = await j(await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code: send.body.code }) }))
  return { ok: verify.status === 200, verify: verify.body }
}, EMAIL)
check('logged in via dev OTP', login.ok, JSON.stringify(login).slice(0, 160))
await login_page.setCookie({ name: 'dev_admin_level', value: '2', url: BASE })
await login_page.close()

// ---- Tab A: editor leader ----
const a = await browser.newPage()
const a_logs = []
a.on('console', m => a_logs.push(m.text()))
a.on('workercreated', w => w.on('console', m => a_logs.push(m.text())))
await a.goto(`${BASE}/${DICT}/entries`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
await sleep(3000)

const editor_fetch = a_logs.some(l => l.includes('fetched fresh snapshot from vps'))
check('editor tab fetched snapshot from the VPS endpoint (not R2)', editor_fetch, a_logs.find(l => l.includes('fetched fresh')) || '')

const entry = (await rpc_in_page(a, { type: 'query', sql: 'SELECT id, phonetic FROM entries ORDER BY id LIMIT 1' }))?.[0]
check('picked a target entry', !!entry?.id, entry?.id)

// ---- Tab B: follower with a broadcast recorder ----
const b = await browser.newPage()
await b.goto(`${BASE}/${DICT}/entries`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
await sleep(2000)
await start_broadcast_recorder(b)

// ---- Editor write in tab A (mimics DictLiveDb#update) ----
const marker = `opfs-edit-${Date.now()}`
const now = new Date().toISOString()
await rpc_in_page(a, {
  type: 'exec',
  sql: `UPDATE "entries" SET "phonetic" = ?, "dirty" = 1, "updated_at" = ? WHERE id = ?`,
  params: [marker, now, entry.id],
  affected_tables: ['entries'],
})

// 4. Persisted in OPFS (re-query the leader)
const after = (await rpc_in_page(a, { type: 'query', sql: 'SELECT phonetic, dirty FROM entries WHERE id = ?', params: [entry.id] }))?.[0]
check('write persisted in OPFS dict DB', after?.phonetic === marker, after?.phonetic)
check('row marked dirty for push', after?.dirty === 1, `dirty=${after?.dirty}`)

// 5. Cross-tab: follower received the broadcast AND reads the marker from the shared leader DB
await sleep(800)
const events = await read_events(b)
const got_broadcast = events.some(e => e?.type === 'tables_changed' && e.tables?.includes('entries'))
check('follower received tables_changed broadcast', got_broadcast, JSON.stringify(events).slice(0, 160))
const b_view = (await rpc_in_page(b, { type: 'query', sql: 'SELECT phonetic FROM entries WHERE id = ?', params: [entry.id] }))?.[0]
check('follower reads the edit from the shared leader DB', b_view?.phonetic === marker, b_view?.phonetic)

// 6. Sync push → dirty clears (editor push to local /changes)
await rpc_in_page(a, { type: 'sync_now' }, { timeout_ms: 60000 }).catch(err => a_logs.push(`sync_now err: ${err.message}`))
await sleep(1500)
const synced = (await rpc_in_page(a, { type: 'query', sql: 'SELECT phonetic, dirty FROM entries WHERE id = ?', params: [entry.id] }))?.[0]
check('editor push cleared dirty after sync', synced?.dirty === null || synced?.dirty === 0, `dirty=${synced?.dirty}`)
check('value survived the sync round-trip', synced?.phonetic === marker, synced?.phonetic)

// 7. NET-ZERO cleanup: restore the original phonetic and push it, so the dev
// server DB (and anything built from it — e.g. the R2 snapshot the local
// builder may upload) never keeps the e2e marker.
await rpc_in_page(a, {
  type: 'exec',
  sql: `UPDATE "entries" SET "phonetic" = ?, "dirty" = 1, "updated_at" = ? WHERE id = ?`,
  params: [entry.phonetic ?? null, new Date().toISOString(), entry.id],
  affected_tables: ['entries'],
})
await rpc_in_page(a, { type: 'sync_now' }, { timeout_ms: 60000 }).catch(err => a_logs.push(`cleanup sync err: ${err.message}`))
await sleep(1000)
const restored = (await rpc_in_page(a, { type: 'query', sql: 'SELECT phonetic, dirty FROM entries WHERE id = ?', params: [entry.id] }))?.[0]
check('cleanup restored the original value (net-zero)', (restored?.phonetic ?? null) === (entry.phonetic ?? null) && (restored?.dirty === null || restored?.dirty === 0), `phonetic=${restored?.phonetic} dirty=${restored?.dirty}`)

await browser.close()
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS')
process.exit(failures.length ? 1 : 0)
