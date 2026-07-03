import type Database from 'better-sqlite3'
import type { TriageResult } from './types'
import BetterSqlite3 from 'better-sqlite3'
import { apply_triage } from './apply-triage'
import { build_triage_context } from './build-context'
import { AGENT_USER_ID } from './constants'

// notify_admin short-circuits on this — keeps the test off the network/SES.
process.env.NTFY_DISABLED = '1'

const DIEGO_USER_ID = 'diego-user-id'

function seed_db(): Database.Database {
  const db = new BetterSqlite3(':memory:')
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT, notify_channel TEXT);
    CREATE TABLE dictionaries (
      id TEXT PRIMARY KEY, url TEXT, name TEXT, entry_count INTEGER, public INTEGER,
      created_by_user_id TEXT, updated_at TEXT);
    CREATE TABLE dictionary_roles (
      id TEXT PRIMARY KEY, dictionary_id TEXT, user_id TEXT, role TEXT);
    CREATE TABLE message_threads (
      id TEXT PRIMARY KEY, subject TEXT, from_name TEXT, from_email TEXT, from_user_id TEXT,
      to_email TEXT, url TEXT,
      assigned_to_user_id TEXT, assigned_at TEXT, assigned_by_user_id TEXT,
      resolved_at TEXT, resolved_by_user_id TEXT,
      triage_verdict TEXT, triage_category TEXT, triage_confidence TEXT,
      triage_summary TEXT, triage_advice TEXT, triage_draft_reply TEXT, triage_at TEXT,
      updated_at TEXT);
    CREATE TABLE messages (
      id TEXT PRIMARY KEY, thread_id TEXT, author_kind TEXT, body_text TEXT, body_html TEXT, created_at TEXT);
  `)
  db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(AGENT_USER_ID, 'agent@livingdictionaries.app', 'LD Triage', 'email')
  db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(DIEGO_USER_ID, 'diego@livingtongues.org', 'Diego Córdova', 'email')
  db.prepare('INSERT INTO users VALUES (?,?,?,?)').run('cust-1', 'maria@example.com', 'Maria', 'email')
  db.prepare('INSERT INTO dictionaries (id, url, name, entry_count, public, updated_at) VALUES (?,?,?,?,?,?)')
    .run('dict1', 'nuxalk', 'Nuxalk', 412, 1, '2026-06-20T00:00:00.000Z')
  db.prepare('INSERT INTO dictionary_roles VALUES (?,?,?,?)')
    .run('role1', 'dict1', 'cust-1', 'editor')
  return db
}

function insert_thread(db: Database.Database, { id, from_user_id, url }: { id: string, from_user_id: string | null, url: string | null }) {
  db.prepare('INSERT INTO message_threads (id, subject, from_name, from_email, from_user_id, to_email, url) VALUES (?,?,?,?,?,?,?)')
    .run(id, 'How do I add a sense?', 'Maria', 'maria@example.com', from_user_id, 'support@livingdictionaries.app', url)
  db.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?)')
    .run(`${id}-m1`, id, 'customer', 'How do I add a second meaning to a word in the Nuxalk dictionary?', null, '2026-06-24T00:00:00.000Z')
}

const content_high: TriageResult = {
  verdict: 'human', category: 'content', confidence: 'high',
  summary: 'How-to: adding multiple senses.', advice: 'Point them to the add-a-sense control.',
  draft_reply: 'Open the entry and add another sense.', spam_reason: null,
}

describe('triage pipeline (build context + apply)', () => {
  test('build_triage_context includes the sender\'s dictionaries + role + page context', () => {
    const db = seed_db()
    insert_thread(db, { id: 't1', from_user_id: 'cust-1', url: 'https://livingdictionaries.app/nuxalk/entries' })
    const ctx = build_triage_context({ db, thread_id: 't1' })
    expect(ctx).not.toBeNull()
    expect(ctx?.is_known_customer).toBeTruthy()
    expect(ctx?.dictionaries[0]).toMatchObject({ name: 'Nuxalk', role: 'editor', entry_count: 412, is_public: true })
    expect(ctx?.page_context).toBe('the "Nuxalk" dictionary — browsing the entries list')
    expect(ctx?.messages).toHaveLength(1)
  })

  test('unknown sender has no dictionaries + is_known_customer false', () => {
    const db = seed_db()
    insert_thread(db, { id: 't1b', from_user_id: null, url: null })
    const ctx = build_triage_context({ db, thread_id: 't1b' })
    expect(ctx?.is_known_customer).toBeFalsy()
    expect(ctx?.dictionaries).toHaveLength(0)
  })

  test('high-confidence content → persists triage cols + assigns to Diego by the agent, not resolved', () => {
    const db = seed_db()
    insert_thread(db, { id: 't2', from_user_id: 'cust-1', url: null })
    const decision = apply_triage({ db, thread_id: 't2', result: content_high })
    expect(decision.action).toBe('auto_assigned')

    const row = db.prepare('SELECT * FROM message_threads WHERE id = ?').get('t2') as Record<string, unknown>
    expect(row.triage_verdict).toBe('human')
    expect(row.triage_category).toBe('content')
    expect(row.triage_draft_reply).toBe('Open the entry and add another sense.')
    expect(row.triage_at).toBeTruthy()
    expect(row.assigned_to_user_id).toBe(DIEGO_USER_ID)
    expect(row.assigned_by_user_id).toBe(AGENT_USER_ID)
    expect(row.resolved_at).toBeNull()
  })

  test('spam → resolves the thread by the agent + does not assign', () => {
    const db = seed_db()
    insert_thread(db, { id: 't3', from_user_id: null, url: null })
    const spam: TriageResult = {
      verdict: 'spam', category: 'other', confidence: 'high',
      summary: 'Phishing.', advice: 'Ignore.', draft_reply: null, spam_reason: 'fake invoice',
    }
    const decision = apply_triage({ db, thread_id: 't3', result: spam })
    expect(decision.action).toBe('spam_resolved')

    const row = db.prepare('SELECT * FROM message_threads WHERE id = ?').get('t3') as Record<string, unknown>
    expect(row.triage_verdict).toBe('spam')
    expect(row.resolved_at).toBeTruthy()
    expect(row.resolved_by_user_id).toBe(AGENT_USER_ID)
    expect(row.assigned_to_user_id).toBeNull()
  })
})
