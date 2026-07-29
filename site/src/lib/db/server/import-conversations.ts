/**
 * Import conversations (`.issues/import-conversations.md`) — the durable
 * manager↔team hub that lives at `/{dict}/import/{thread_id}`.
 *
 * One `message_threads` row per import request, worked by BOTH sides on the same
 * page. Everything written here is visible to everyone in the conversation:
 * there are no internal notes (team-only chatter belongs in team chat), so no
 * message ever needs a visibility check.
 *
 * The freeze rule is a single stamp: `started_at`. Before it the uploader may
 * still edit and withdraw; after it the resources are permanent dictionary
 * history. See `is_conversation_frozen`.
 */
import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { is_admin } from '$lib/admins'
import { open_test_shared_db } from './shared-db'

export type ConversationSide = 'manager' | 'team'
export type ConversationAuthorKind = 'customer' | 'admin' | 'agent' | 'system'
export type QuestionKind = 'text' | 'choice' | 'multi_choice'
export type QuestionStatus = 'open' | 'answered' | 'closed'
export type ArtifactKind = 'preview' | 'report'

export interface ConversationRow {
  id: string
  dictionary_id: string
  subject: string | null
  from_user_id: string | null
  from_email: string
  from_name: string | null
  import_request_note: string | null
  started_at: string | null
  started_by_user_id: string | null
  activity_batch: number | null
  assigned_to_user_id: string | null
  resolved_at: string | null
  last_message_at: string
  created_at: string
  updated_at: string
}

export interface ConversationMessageRow {
  id: string
  thread_id: string
  author_user_id: string | null
  author_kind: ConversationAuthorKind
  body_text: string | null
  message_id: string | null
  created_at: string
}

export interface QuestionOption {
  value: string
  label: string
}

export interface ThreadQuestionRow {
  id: string
  thread_id: string
  dictionary_id: string
  position: number
  kind: QuestionKind
  title: string
  body_html: string | null
  options_json: string | null
  report_anchor: string | null
  /** JSON entries-view filter (`$lib/search/entries-query-link.ts`) — the "show me these entries" button. */
  entries_query: string | null
  entries_query_label: string | null
  answer_text: string | null
  answer_values_json: string | null
  answered_by_user_id: string | null
  answered_at: string | null
  status: QuestionStatus
  created_at: string
  updated_at: string
}

export interface ThreadArtifactRow {
  id: string
  thread_id: string
  dictionary_id: string
  kind: ArtifactKind
  title: string | null
  storage_key: string
  mimetype: string
  size_bytes: number
  import_id: string | null
  source_id: string | null
  stats_json: string | null
  created_by_user_id: string | null
  created_at: string
}

const CONVERSATION_COLUMNS = `
  id, dictionary_id, subject, from_user_id, from_email, from_name,
  import_request_note, started_at, started_by_user_id, activity_batch,
  assigned_to_user_id, resolved_at, last_message_at, created_at, updated_at
`

export function artifact_storage_key({ dictionary_id, artifact_id }: { dictionary_id: string, artifact_id: string }): string {
  return `import/${dictionary_id}/artifacts/${artifact_id}.html`
}

/**
 * Once the team has started, the uploaded resources are permanent dictionary
 * history — the manager can no longer edit or remove them. This is the only
 * freeze rule; resolving a conversation deliberately does NOT affect it.
 */
export function is_conversation_frozen(conversation: Pick<ConversationRow, 'started_at'>): boolean {
  return !!conversation.started_at
}

export function get_conversation({ db, dictionary_id, thread_id }: {
  db: Database
  dictionary_id: string
  thread_id: string
}): ConversationRow | null {
  const row = db.prepare(`SELECT ${CONVERSATION_COLUMNS} FROM message_threads WHERE id = ? AND dictionary_id = ? AND thread_kind = 'import'`)
    .get(thread_id, dictionary_id) as ConversationRow | undefined
  return row ?? null
}

export function list_conversations({ db, dictionary_id }: { db: Database, dictionary_id: string }): ConversationRow[] {
  return db.prepare(`SELECT ${CONVERSATION_COLUMNS} FROM message_threads WHERE dictionary_id = ? AND thread_kind = 'import' ORDER BY created_at DESC`)
    .all(dictionary_id) as ConversationRow[]
}

export function list_conversation_messages({ db, thread_id }: { db: Database, thread_id: string }): ConversationMessageRow[] {
  return db.prepare('SELECT id, thread_id, author_user_id, author_kind, body_text, message_id, created_at FROM messages WHERE thread_id = ? ORDER BY created_at')
    .all(thread_id) as ConversationMessageRow[]
}

/** Membership is additive — posting, being assigned, or opening the page joins you. */
export function ensure_participant({ db, thread_id, user_id, side, now = new Date().toISOString() }: {
  db: Database
  thread_id: string
  user_id: string
  side: ConversationSide
  now?: string
}): void {
  db.prepare('INSERT INTO thread_participants (thread_id, user_id, side, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(thread_id, user_id) DO NOTHING')
    .run(thread_id, user_id, side, now)
}

export function side_for_user({ db, user_id }: { db: Database, user_id: string }): ConversationSide {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(user_id) as { email: string | null } | undefined
  return is_admin(user?.email) ? 'team' : 'manager'
}

export function post_conversation_message({ db, thread_id, user_id, author_kind, body_text, message_id = null, now = new Date().toISOString() }: {
  db: Database
  thread_id: string
  user_id: string | null
  author_kind: ConversationAuthorKind
  body_text: string
  /** RFC Message-ID when this message was also emailed out (lets a stray reply thread back). */
  message_id?: string | null
  now?: string
}): string {
  const id = randomUUID()
  const write = db.transaction(() => {
    db.prepare('INSERT INTO messages (id, thread_id, author_user_id, author_kind, body_text, message_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, thread_id, user_id, author_kind, body_text, message_id, now, now)
    db.prepare('UPDATE message_threads SET last_message_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, thread_id)
    if (user_id) {
      db.prepare('INSERT INTO thread_participants (thread_id, user_id, side, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(thread_id, user_id) DO NOTHING')
        .run(thread_id, user_id, side_for_user({ db, user_id }), now)
    }
  })
  write()
  return id
}

/** Stamps the RFC Message-ID the outbound notification actually got from SES. */
export function set_message_rfc_id({ db, message_row_id, message_id }: {
  db: Database
  message_row_id: string
  message_id: string
}): void {
  db.prepare('UPDATE messages SET message_id = ? WHERE id = ?').run(message_id, message_row_id)
}

/** Guide Phase 0 — the team has begun; resources freeze from here on. Idempotent. */
export function start_conversation({ db, thread_id, user_id, now = new Date().toISOString() }: {
  db: Database
  thread_id: string
  user_id: string
  now?: string
}): void {
  db.prepare(`
    UPDATE message_threads SET
      started_at = COALESCE(started_at, ?),
      started_by_user_id = COALESCE(started_by_user_id, ?),
      updated_at = ?
    WHERE id = ?
  `).run(now, user_id, now, thread_id)
}

export function set_conversation_resolved({ db, thread_id, user_id, resolved, now = new Date().toISOString() }: {
  db: Database
  thread_id: string
  user_id: string
  resolved: boolean
  now?: string
}): void {
  db.prepare('UPDATE message_threads SET resolved_at = ?, resolved_by_user_id = ?, updated_at = ? WHERE id = ?')
    .run(resolved ? now : null, resolved ? user_id : null, now, thread_id)
}

/**
 * Marks the conversation read for one participant. When a TEAM member reads it,
 * the `activity_batch` counter advances, which re-arms the Notifications-room
 * notice (the next manager post gets a fresh `client_message_id` and so posts
 * again) — that is the whole "one notice per unread batch" mechanism.
 */
export function mark_conversation_read({ db, thread_id, user_id, side, now = new Date().toISOString() }: {
  db: Database
  thread_id: string
  user_id: string
  side: ConversationSide
  now?: string
}): void {
  const read = db.transaction(() => {
    ensure_participant({ db, thread_id, user_id, side, now })
    db.prepare('UPDATE thread_participants SET last_read_at = ? WHERE thread_id = ? AND user_id = ?')
      .run(now, thread_id, user_id)
    if (side === 'team')
      db.prepare('UPDATE message_threads SET activity_batch = COALESCE(activity_batch, 0) + 1 WHERE id = ?').run(thread_id)
  })
  read()
}

export function count_unread_for_user({ db, thread_id, user_id }: {
  db: Database
  thread_id: string
  user_id: string
}): number {
  const row = db.prepare(`
    SELECT COUNT(*) AS unread FROM messages
    WHERE thread_id = ?
      AND author_user_id IS NOT ?
      AND created_at > COALESCE((SELECT last_read_at FROM thread_participants WHERE thread_id = ? AND user_id = ?), '')
  `).get(thread_id, user_id, thread_id, user_id) as { unread: number }
  return row.unread
}

// ---------------------------------------------------------------- artifacts

export function create_artifact({ db, thread_id, dictionary_id, kind, title, mimetype, size_bytes, import_id = null, source_id = null, stats_json = null, created_by_user_id, now = new Date().toISOString() }: {
  db: Database
  thread_id: string
  dictionary_id: string
  kind: ArtifactKind
  title: string | null
  mimetype: string
  size_bytes: number
  import_id?: string | null
  source_id?: string | null
  stats_json?: string | null
  created_by_user_id: string | null
  now?: string
}): ThreadArtifactRow {
  const id = randomUUID()
  const storage_key = artifact_storage_key({ dictionary_id, artifact_id: id })
  db.prepare(`
    INSERT INTO thread_artifacts (
      id, thread_id, dictionary_id, kind, title, storage_key, mimetype,
      size_bytes, import_id, source_id, stats_json, created_by_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, thread_id, dictionary_id, kind, title, storage_key, mimetype, size_bytes, import_id, source_id, stats_json, created_by_user_id, now)
  return get_artifact({ db, artifact_id: id }) as ThreadArtifactRow
}

export function list_artifacts({ db, thread_id }: { db: Database, thread_id: string }): ThreadArtifactRow[] {
  return db.prepare('SELECT * FROM thread_artifacts WHERE thread_id = ? ORDER BY created_at')
    .all(thread_id) as ThreadArtifactRow[]
}

export function get_artifact({ db, artifact_id }: { db: Database, artifact_id: string }): ThreadArtifactRow | null {
  return (db.prepare('SELECT * FROM thread_artifacts WHERE id = ?').get(artifact_id) as ThreadArtifactRow | undefined) ?? null
}

// ---------------------------------------------------------------- questions

export interface NewQuestion {
  kind: QuestionKind
  title: string
  body_html?: string | null
  options?: QuestionOption[] | null
  report_anchor?: string | null
  /** Already-validated JSON (see `parse_entries_query`) — never raw agent input. */
  entries_query?: string | null
  entries_query_label?: string | null
}

export function create_questions({ db, thread_id, dictionary_id, questions, created_by_user_id, now = new Date().toISOString() }: {
  db: Database
  thread_id: string
  dictionary_id: string
  questions: NewQuestion[]
  created_by_user_id: string | null
  now?: string
}): ThreadQuestionRow[] {
  const next_position = (db.prepare('SELECT COALESCE(MAX(position), 0) AS max FROM thread_questions WHERE thread_id = ?')
    .get(thread_id) as { max: number }).max
  const insert = db.prepare(`
    INSERT INTO thread_questions (
      id, thread_id, dictionary_id, position, kind, title, body_html,
      options_json, report_anchor, entries_query, entries_query_label,
      status, created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `)
  const ids: string[] = []
  const write = db.transaction(() => {
    questions.forEach((question, index) => {
      const id = randomUUID()
      ids.push(id)
      insert.run(
        id,
        thread_id,
        dictionary_id,
        next_position + index + 1,
        question.kind,
        question.title,
        question.body_html ?? null,
        question.options?.length ? JSON.stringify(question.options) : null,
        question.report_anchor ?? null,
        question.entries_query ?? null,
        question.entries_query_label ?? null,
        created_by_user_id,
        now,
        now,
      )
    })
  })
  write()
  return list_questions({ db, thread_id }).filter(question => ids.includes(question.id))
}

export function list_questions({ db, thread_id }: { db: Database, thread_id: string }): ThreadQuestionRow[] {
  return db.prepare('SELECT * FROM thread_questions WHERE thread_id = ? ORDER BY position')
    .all(thread_id) as ThreadQuestionRow[]
}

export function get_question({ db, question_id }: { db: Database, question_id: string }): ThreadQuestionRow | null {
  return (db.prepare('SELECT * FROM thread_questions WHERE id = ?').get(question_id) as ThreadQuestionRow | undefined) ?? null
}

/**
 * Records an answer. An empty answer clears it back to `open` — a manager
 * deleting what they typed should not leave the question looking answered.
 */
export function answer_question({ db, question_id, answer_text, answer_values, answered_by_user_id, now = new Date().toISOString() }: {
  db: Database
  question_id: string
  answer_text?: string | null
  answer_values?: string[] | null
  answered_by_user_id: string
  now?: string
}): ThreadQuestionRow | null {
  const text_answer = answer_text?.trim() || null
  const value_answers = answer_values?.length ? answer_values : null
  const is_answered = !!text_answer || !!value_answers
  db.prepare(`
    UPDATE thread_questions SET
      answer_text = ?,
      answer_values_json = ?,
      answered_by_user_id = ?,
      answered_at = ?,
      status = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    text_answer,
    value_answers ? JSON.stringify(value_answers) : null,
    is_answered ? answered_by_user_id : null,
    is_answered ? now : null,
    is_answered ? 'answered' : 'open',
    now,
    question_id,
  )
  return get_question({ db, question_id })
}

export function count_open_questions({ db, thread_id }: { db: Database, thread_id: string }): number {
  return (db.prepare(`SELECT COUNT(*) AS open FROM thread_questions WHERE thread_id = ? AND status = 'open'`)
    .get(thread_id) as { open: number }).open
}

if (import.meta.vitest) {
  function seed() {
    const db = open_test_shared_db()
    db.prepare('INSERT INTO users (id, email, name) VALUES (?, ?, ?)').run('manager', 'manager@example.com', 'Manny')
    db.prepare('INSERT INTO users (id, email, name) VALUES (?, ?, ?)').run('admin', 'jwrunner7@gmail.com', 'Jacob')
    db.prepare(`
      INSERT INTO message_threads (id, subject, source, from_user_id, from_email, dictionary_id, thread_kind, last_message_at, created_at, updated_at)
      VALUES ('t1', 'Import request', 'contact_form', 'manager', 'manager@example.com', 'd1', 'import', '2026-07-25T00:00:00Z', '2026-07-25T00:00:00Z', '2026-07-25T00:00:00Z')
    `).run()
    return db
  }

  describe(is_conversation_frozen, () => {
    test('freezes on started_at and nothing else', () => {
      expect(is_conversation_frozen({ started_at: null })).toBe(false)
      expect(is_conversation_frozen({ started_at: '2026-07-25T00:00:00Z' })).toBe(true)
    })
  })

  describe(start_conversation, () => {
    test('stamps once and keeps the original starter on repeat calls', () => {
      const db = seed()
      start_conversation({ db, thread_id: 't1', user_id: 'admin', now: '2026-07-25T01:00:00Z' })
      start_conversation({ db, thread_id: 't1', user_id: 'manager', now: '2026-07-25T02:00:00Z' })
      const conversation = get_conversation({ db, dictionary_id: 'd1', thread_id: 't1' })
      expect(conversation?.started_at).toBe('2026-07-25T01:00:00Z')
      expect(conversation?.started_by_user_id).toBe('admin')
    })
  })

  describe(post_conversation_message, () => {
    test('adds the author as a participant on the correct side and bumps last_message_at', () => {
      const db = seed()
      post_conversation_message({ db, thread_id: 't1', user_id: 'manager', author_kind: 'customer', body_text: 'Any news?', now: '2026-07-25T03:00:00Z' })
      post_conversation_message({ db, thread_id: 't1', user_id: 'admin', author_kind: 'admin', body_text: 'All done.', now: '2026-07-25T04:00:00Z' })
      const sides = db.prepare('SELECT user_id, side FROM thread_participants WHERE thread_id = ? ORDER BY user_id').all('t1')
      expect(sides).toEqual([{ user_id: 'admin', side: 'team' }, { user_id: 'manager', side: 'manager' }])
      expect(get_conversation({ db, dictionary_id: 'd1', thread_id: 't1' })?.last_message_at).toBe('2026-07-25T04:00:00Z')
    })
  })

  describe(mark_conversation_read, () => {
    test('only a team read advances the notification batch', () => {
      const db = seed()
      mark_conversation_read({ db, thread_id: 't1', user_id: 'manager', side: 'manager', now: '2026-07-25T03:00:00Z' })
      expect(get_conversation({ db, dictionary_id: 'd1', thread_id: 't1' })?.activity_batch ?? 0).toBe(0)
      mark_conversation_read({ db, thread_id: 't1', user_id: 'admin', side: 'team', now: '2026-07-25T04:00:00Z' })
      expect(get_conversation({ db, dictionary_id: 'd1', thread_id: 't1' })?.activity_batch).toBe(1)
    })
  })

  describe(count_unread_for_user, () => {
    test('counts only other people messages posted after the last read', () => {
      const db = seed()
      post_conversation_message({ db, thread_id: 't1', user_id: 'admin', author_kind: 'admin', body_text: 'one', now: '2026-07-25T01:00:00Z' })
      expect(count_unread_for_user({ db, thread_id: 't1', user_id: 'manager' })).toBe(1)
      mark_conversation_read({ db, thread_id: 't1', user_id: 'manager', side: 'manager', now: '2026-07-25T02:00:00Z' })
      expect(count_unread_for_user({ db, thread_id: 't1', user_id: 'manager' })).toBe(0)
      post_conversation_message({ db, thread_id: 't1', user_id: 'admin', author_kind: 'admin', body_text: 'two', now: '2026-07-25T03:00:00Z' })
      post_conversation_message({ db, thread_id: 't1', user_id: 'manager', author_kind: 'customer', body_text: 'mine', now: '2026-07-25T04:00:00Z' })
      expect(count_unread_for_user({ db, thread_id: 't1', user_id: 'manager' })).toBe(1)
    })
  })

  describe(create_questions, () => {
    test('appends positions after existing questions and stores options', () => {
      const db = seed()
      create_questions({ db, thread_id: 't1', dictionary_id: 'd1', created_by_user_id: 'admin', questions: [{ kind: 'text', title: 'Who compiled this?' }] })
      const [second] = create_questions({
        db,
        thread_id: 't1',
        dictionary_id: 'd1',
        created_by_user_id: 'admin',
        questions: [{ kind: 'choice', title: 'Raised dot?', options: [{ value: 'morpheme', label: 'Morpheme break' }, { value: 'length', label: 'Vowel length' }] }],
      })
      expect(second.position).toBe(2)
      expect(JSON.parse(second.options_json as string)).toEqual([{ value: 'morpheme', label: 'Morpheme break' }, { value: 'length', label: 'Vowel length' }])
      expect(count_open_questions({ db, thread_id: 't1' })).toBe(2)
    })
  })

  describe(answer_question, () => {
    test('marks answered, and clearing the answer reopens it', () => {
      const db = seed()
      const [question] = create_questions({ db, thread_id: 't1', dictionary_id: 'd1', created_by_user_id: 'admin', questions: [{ kind: 'text', title: 'Who compiled this?' }] })
      const answered = answer_question({ db, question_id: question.id, answer_text: 'A 1990s class handout', answered_by_user_id: 'manager', now: '2026-07-25T05:00:00Z' })
      expect(answered?.status).toBe('answered')
      expect(answered?.answered_by_user_id).toBe('manager')
      expect(count_open_questions({ db, thread_id: 't1' })).toBe(0)
      const cleared = answer_question({ db, question_id: question.id, answer_text: '   ', answered_by_user_id: 'manager' })
      expect(cleared?.status).toBe('open')
      expect(cleared?.answered_at).toBe(null)
    })

    test('records choice selections', () => {
      const db = seed()
      const [question] = create_questions({
        db,
        thread_id: 't1',
        dictionary_id: 'd1',
        created_by_user_id: 'admin',
        questions: [{ kind: 'choice', title: 'Raised dot?', options: [{ value: 'morpheme', label: 'Morpheme break' }] }],
      })
      const answered = answer_question({ db, question_id: question.id, answer_values: ['morpheme'], answered_by_user_id: 'manager' })
      expect(JSON.parse(answered?.answer_values_json as string)).toEqual(['morpheme'])
      expect(answered?.status).toBe('answered')
    })
  })

  describe(list_conversations, () => {
    test('only returns import-kind threads for the dictionary', () => {
      const db = seed()
      db.prepare(`
        INSERT INTO message_threads (id, subject, source, from_email, dictionary_id, last_message_at, created_at, updated_at)
        VALUES ('t2', 'Just an email', 'email', 'someone@example.com', 'd1', '2026-07-25T00:00:00Z', '2026-07-25T00:00:00Z', '2026-07-25T00:00:00Z')
      `).run()
      expect(list_conversations({ db, dictionary_id: 'd1' }).map(row => row.id)).toEqual(['t1'])
    })
  })
}
