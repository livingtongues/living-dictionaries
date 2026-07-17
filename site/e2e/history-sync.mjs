#!/usr/bin/env node
// Change-history capture proof (server-side audit log). HTTP-only — no browser.
//
//   pnpm -F site build && pnpm -F site test:history
//
// Boots `node build` on an ISOLATED temp DATA_DIR, seeds shared.db with two
// managers + a contributor user, then drives a sequence of real
// `POST /api/dictionary/[id]/changes` syncs of every shape (cold viewer
// pull, manager inserts/updates, a text+sentence+sense link, media + speaker, a
// LWW-losing second-manager push, a delete, a mid-stream viewer pull). After
// each it reads the on-disk `<id>.db` + `<id>.history.db` and asserts the
// `changes` / `change_owners` look right, then checks the `GET …/history` role
// gate (manager → 200, contributor/anon → 403/401).
/* eslint-disable no-console, node/prefer-global/process */

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import Database from 'better-sqlite3'

const dir = dirname(fileURLToPath(import.meta.url))
const site_dir = join(dir, '..')
const port = process.env.HISTORY_PORT || '3102'
const base = `http://localhost:${port}`
const DICT = 'histtest'
const MIGRATION = '20260702_initial.sql'

const data_dir = mkdtempSync(join(tmpdir(), 'ld-history-'))
const shared_db_path = join(data_dir, 'shared.db')
const dict_db_path = join(data_dir, 'dictionaries', `${DICT}.db`)
const history_db_path = join(data_dir, 'dictionaries', `${DICT}.history.db`)

const USERS = {
  manager: { id: 'u_manager', email: 'hist-manager@example.com', role: 'manager' },
  second_manager: { id: 'u_second_manager', email: 'hist-second-manager@example.com', role: 'manager' },
  contributor: { id: 'u_contributor', email: 'hist-contributor@example.com', role: 'contributor' },
}

let server
let passed = 0
function ok(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`)
  passed++
  console.log(`  ✓ ${msg}`)
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: site_dir, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`))))
  })
}

function boot_server() {
  return new Promise((resolve, reject) => {
    console.log(`• booting \`node build\` on :${port} (DATA_DIR=${data_dir})…`)
    server = spawn('node', ['build'], {
      cwd: site_dir,
      env: {
        ...process.env,
        PORT: port,
        DATA_DIR: data_dir,
        JWT_SECRET: process.env.JWT_SECRET || 'e2e-test-secret-that-is-long-enough-for-hs256',
        E2E_EXPOSE_OTP: 'true',
      },
    })
    const timer = setTimeout(() => reject(new Error('server did not log "Listening on" within 30s')), 30000)
    server.stdout.on('data', (chunk) => { if (chunk.toString().includes('Listening on')) { clearTimeout(timer); resolve() } })
    server.stderr.on('data', chunk => process.stderr.write(chunk))
    server.on('error', reject)
    server.on('close', code => reject(new Error(`server exited early (code ${code})`)))
  })
}

async function api(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const set = res.headers.getSetCookie?.() ?? []
  let json = null
  try { json = await res.json() } catch { /* non-json */ }
  return { status: res.status, json, set_cookie: set }
}

async function login(email) {
  const sent = await api('/api/auth/email/send-code', { method: 'POST', body: { email } })
  const code = sent.json?.code
  if (!code) throw new Error(`send-code did not expose a code for ${email} (E2E_EXPOSE_OTP?)`)
  const verified = await api('/api/auth/email/verify', { method: 'POST', body: { email, code } })
  if (verified.status !== 200) throw new Error(`verify failed for ${email}: ${verified.status}`)
  const session = verified.set_cookie.map(c => c.split(';')[0]).find(c => c.startsWith('session='))
  if (!session) throw new Error(`no session cookie for ${email}`)
  return session
}

function seed_shared() {
  const db = new Database(shared_db_path)
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO dictionaries (id, url, name, entry_count, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?) ON CONFLICT(id) DO NOTHING`,
  ).run(DICT, DICT, 'History Test Dictionary', now, now)
  const user_stmt = db.prepare(
    `INSERT INTO users (id, email, name, providers, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email`,
  )
  const role_stmt = db.prepare(
    `INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  for (const u of Object.values(USERS)) {
    user_stmt.run(u.id, u.email, u.email, JSON.stringify([{ provider: 'email', provider_id: u.email }]), now, now)
    db.prepare('DELETE FROM dictionary_roles WHERE user_id = ? AND dictionary_id = ?').run(u.id, DICT)
    role_stmt.run(randomUUID(), DICT, u.id, u.role, now, now)
  }
  db.close()
}

// ── dirty-row builders (full rows incl. the NOT NULL audit columns) ──────────
const stamp = uid => ({ created_by_user_id: uid, updated_by_user_id: uid, dirty: 1 })
function entry(id, at, uid, over = {}) {
  return { id, lexeme: { en: 'water' }, phonetic: null, interlinearization: null, morphology: null, notes: null, sources: null, scientific_names: null, coordinates: null, unsupported_fields: null, elicitation_id: null, created_at: at, updated_at: at, ...stamp(uid), ...over }
}
function sense(id, entry_id, at, uid, over = {}) {
  return { id, entry_id, definition: null, glosses: { en: 'the liquid' }, parts_of_speech: null, semantic_domains: null, write_in_semantic_domains: null, noun_class: null, plural_form: null, variant: null, created_at: at, updated_at: at, ...stamp(uid), ...over }
}
function text(id, at, uid, over = {}) {
  return { id, title: { en: 'A Story' }, created_at: at, updated_at: at, ...stamp(uid), ...over }
}
function sentence(id, at, uid, over = {}) {
  return { id, text: { en: 'The water is cold.' }, translation: null, text_id: null, sort_key: null, ends_paragraph: null, created_at: at, updated_at: at, ...stamp(uid), ...over }
}
function sis(id, sense_id, sentence_id, at, uid) {
  return { id, sense_id, sentence_id, created_at: at, updated_at: at, ...stamp(uid) }
}
function speaker(id, at, uid) {
  return { id, name: 'Speaker One', decade: null, gender: null, birthplace: null, user_id: null, created_at: at, updated_at: at, ...stamp(uid) }
}
function audio(id, at, uid, over = {}) {
  return { id, entry_id: null, sentence_id: null, text_id: null, storage_path: 'audio/x.mp3', source: null, created_at: at, updated_at: at, ...stamp(uid), ...over }
}
function audio_speaker(id, audio_id, speaker_id, at, uid) {
  return { id, audio_id, speaker_id, created_at: at, updated_at: at, ...stamp(uid) }
}

function push(cookie, dirty_rows = {}, deletes = []) {
  return api(`/api/dictionary/${DICT}/changes`, {
    method: 'POST',
    cookie,
    body: { synced_up_to: null, dirty_rows, deletes, latest_dict_migration: MIGRATION },
  })
}

function open_ro(path) { return new Database(path, { readonly: true }) }
function all_changes() {
  const db = open_ro(history_db_path)
  try { return db.prepare('SELECT rowid, id, table_name, row_id, op, user_id FROM changes ORDER BY rowid').all() } finally { db.close() }
}
function owners_for(owner_type, owner_id) {
  const db = open_ro(history_db_path)
  try {
    return db.prepare(
      `SELECT c.table_name, c.op FROM changes c JOIN change_owners o ON o.change_id = c.id
        WHERE o.owner_type = ? AND o.owner_id = ? ORDER BY c.rowid`,
    ).all(owner_type, owner_id)
  } finally { db.close() }
}

async function main() {
  if (!existsSync(join(site_dir, 'build/index.js'))) await run('pnpm', ['build'])
  await boot_server()

  // Warm up so the server creates + migrates shared.db, then seed it.
  await api('/api/auth/email/send-code', { method: 'POST', body: { email: 'warmup@example.com' } })
  seed_shared()
  console.log('• seeded shared.db: dictionary + two managers + contributor')

  const manager = await login(USERS.manager.email)
  const second_manager = await login(USERS.second_manager.email)
  const contributor = await login(USERS.contributor.email)
  console.log('• logged in all three roles')

  console.log('\n— step 1: cold viewer pull (anonymous) creates no history')
  const cold = await push(undefined, {}, [])
  ok(cold.status === 200, 'anonymous pull-only sync returns 200')
  ok(!existsSync(history_db_path), 'no history.db file exists after a pull-only sync')

  console.log('\n— step 2: manager inserts entry + sense')
  ok((await push(manager, { entries: [entry('e1', '2026-01-01T00:00:00.000Z', USERS.manager.id)], senses: [sense('s1', 'e1', '2026-01-01T00:00:00.000Z', USERS.manager.id)] })).status === 200, 'manager push 200')
  let rows = all_changes()
  ok(rows.length === 2, 'two change rows (entry + sense insert)')
  ok(rows.every(r => r.op === 'insert'), 'both are inserts')
  ok(rows.every(r => r.user_id === USERS.manager.id), 'recorded user = authenticated manager')
  {
    const db = open_ro(shared_db_path)
    const { entry_count } = db.prepare('SELECT entry_count FROM dictionaries WHERE id = ?').get(DICT)
    db.close()
    ok(entry_count === 1, 'catalog entry_count recounted to 1 after the push')
  }

  console.log('\n— step 3: manager edits entry phonetic')
  await push(manager, { entries: [entry('e1', '2026-01-02T00:00:00.000Z', USERS.manager.id, { phonetic: 'ˈwɔːtər' })] })
  const entry_update = all_changes().find(r => r.table_name === 'entries' && r.op === 'update')
  ok(!!entry_update, 'an entries update change exists')
  {
    const db = open_ro(history_db_path)
    const delta = JSON.parse(db.prepare('SELECT delta FROM changes WHERE id = ?').get(entry_update.id).delta)
    db.close()
    ok(delta.phonetic && delta.phonetic.new === 'ˈwɔːtər' && delta.phonetic.old === null, 'delta carries only phonetic {old:null,new}')
  }

  console.log('\n— step 4: manager adds a text + a sentence in it + links the sense')
  await push(manager, {
    texts: [text('tx1', '2026-01-03T00:00:00.000Z', USERS.manager.id)],
    sentences: [sentence('snt1', '2026-01-03T00:00:00.000Z', USERS.manager.id, { text_id: 'tx1', sort_key: 'a' })],
    senses_in_sentences: [sis('j1', 's1', 'snt1', '2026-01-03T00:00:00.000Z', USERS.manager.id)],
  })

  console.log('\n— step 5: manager adds a speaker + audio on the entry + links the speaker')
  await push(manager, {
    speakers: [speaker('sp1', '2026-01-04T00:00:00.000Z', USERS.manager.id)],
    audio: [audio('a1', '2026-01-04T00:00:00.000Z', USERS.manager.id, { entry_id: 'e1' })],
    audio_speakers: [audio_speaker('as1', 'a1', 'sp1', '2026-01-04T00:00:00.000Z', USERS.manager.id)],
  })

  console.log('\n— step 6: a SECOND manager pushes a stale (older updated_at) entry → LWW loses, no history')
  const before_lww = all_changes().length
  await push(second_manager, { entries: [entry('e1', '2025-06-01T00:00:00.000Z', USERS.second_manager.id, { phonetic: 'STALE' })] })
  ok(all_changes().length === before_lww, 'LWW-losing push recorded no history row')

  console.log('\n— step 7: second manager edits the sentence (junction now exists → overlaps text + entry)')
  await push(second_manager, { sentences: [sentence('snt1', '2026-01-05T00:00:00.000Z', USERS.second_manager.id, { text_id: 'tx1', sort_key: 'a', text: { en: 'The water is very cold.' } })] })
  const sentence_update = all_changes().find(r => r.table_name === 'sentences' && r.op === 'update')
  ok(sentence_update.user_id === USERS.second_manager.id, 'sentence edit attributed to the second manager')
  {
    const db = open_ro(history_db_path)
    const owner_types = db.prepare('SELECT owner_type FROM change_owners WHERE change_id = ? ORDER BY owner_type').all(sentence_update.id).map(o => o.owner_type)
    db.close()
    ok(JSON.stringify(owner_types) === JSON.stringify(['entry', 'sentence', 'text']), 'sentence edit owners = entry + sentence + text')
  }

  console.log('\n— step 8: manager deletes the sense')
  await push(manager, {}, [{ table_name: 'senses', id: 's1' }])
  const del = all_changes().find(r => r.op === 'delete')
  ok(!!del && del.table_name === 'senses' && del.row_id === 's1', 'a senses delete change exists')
  {
    const db = open_ro(history_db_path)
    const snap = JSON.parse(db.prepare('SELECT snapshot FROM changes WHERE id = ?').get(del.id).snapshot)
    db.close()
    ok(snap.glosses && snap.glosses.en === 'the liquid', 'delete snapshot holds the pre-delete image')
  }
  ok(!open_ro(dict_db_path).prepare('SELECT 1 FROM senses WHERE id = ?').get('s1'), 'the sense row is gone from the dict db')

  console.log('\n— step 9: a mid-stream anonymous pull still records nothing')
  const before_pull = all_changes().length
  await push(undefined, {}, [])
  ok(all_changes().length === before_pull, 'anonymous pull added no history')

  console.log('\n— attribution boundaries')
  const entry_tl = owners_for('entry', 'e1')
  ok(entry_tl.some(c => c.table_name === 'entries' && c.op === 'insert'), 'entry timeline has the entry insert')
  ok(entry_tl.some(c => c.table_name === 'senses_in_sentences'), 'entry timeline has the sense↔sentence link')
  ok(entry_tl.some(c => c.table_name === 'audio_speakers'), 'entry timeline has the audio-speaker link')
  ok(entry_tl.some(c => c.table_name === 'senses' && c.op === 'delete'), 'entry timeline has the sense delete')
  ok(!entry_tl.some(c => c.table_name === 'speakers'), 'entry timeline does NOT include the speaker rename')
  ok(!entry_tl.some(c => c.table_name === 'texts'), 'entry timeline does NOT include the text (no entry→text bubbling)')
  const text_tl = owners_for('text', 'tx1')
  ok(text_tl.some(c => c.table_name === 'texts'), 'text timeline has the text insert')
  ok(text_tl.some(c => c.table_name === 'sentences'), 'text timeline has the sentence')
  ok(!text_tl.some(c => c.table_name === 'entries'), 'text timeline does NOT include entry edits')

  console.log('\n— GET /history role gate + payload')
  const m = await api(`/api/dictionary/${DICT}/history?owner_type=entry&owner_id=e1`, { cookie: manager })
  ok(m.status === 200, 'manager can read entry history (200)')
  ok(Array.isArray(m.json.changes) && m.json.changes.length > 0, 'manager gets a non-empty entry timeline')
  ok(m.json.users[USERS.manager.id]?.email === USERS.manager.email, 'response resolves the manager display name')
  ok(m.json.changes[0].at >= m.json.changes[m.json.changes.length - 1].at, 'timeline is newest-first')
  const e = await api(`/api/dictionary/${DICT}/history?owner_type=entry&owner_id=e1`, { cookie: second_manager })
  ok(e.status === 200, 'second manager can read history (200)')
  const feed = await api(`/api/dictionary/${DICT}/history?feed=1`, { cookie: manager })
  ok(feed.json.changes.some(c => c.table_name === 'speakers'), 'dict-wide feed includes the unattributed speaker change')
  const c = await api(`/api/dictionary/${DICT}/history?owner_type=entry&owner_id=e1`, { cookie: contributor })
  ok(c.status === 403, 'contributor is FORBIDDEN (403)')
  const anon = await api(`/api/dictionary/${DICT}/history?owner_type=entry&owner_id=e1`)
  ok(anon.status === 401 || anon.status === 403, 'anonymous is rejected (401/403)')

  console.log(`\n✅ history-sync PASS — ${passed} assertions`)
}

main()
  .catch((error) => { console.error(`\n❌ history-sync FAIL — ${error.message}`); console.error(error.stack); process.exitCode = 1 })
  .finally(() => {
    if (server && !server.killed) server.kill('SIGTERM')
    try { rmSync(data_dir, { recursive: true, force: true }) } catch { /* ignore */ }
  })
