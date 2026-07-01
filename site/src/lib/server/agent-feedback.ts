import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

/**
 * Agent feedback → a support message, NOT a client_log. An agent using the v1
 * API (read OR write key) can send us a request/complaint ("I need a field for
 * X", "this endpoint is awkward"). It lands as an UNRESOLVED `message_threads`
 * row assigned to the feedback owner — same inbox surface as a customer email —
 * so we see it fast instead of it drowning in the telemetry log. The human whose
 * key it is is snapshotted as the sender, so any reply reaches them.
 *
 * Anti-flood: a per-key in-memory rate limit, plus a cap on how many OPEN
 * feedback threads one key may have — past the cap we append to the newest open
 * thread instead of spawning more.
 */

/** Feedback threads are assigned to this admin (see $lib/admins.ts). */
export const FEEDBACK_OWNER_EMAIL = 'jwrunner7@gmail.com'

export const FEEDBACK_SOURCE = 'agent_feedback'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const MAX_PER_HOUR = 3
const MAX_PER_DAY = 10
/** Past this many open (unresolved) feedback threads, new ones fold into the newest. */
const MAX_OPEN_THREADS_PER_KEY = 10

export const FEEDBACK_KINDS = ['missing_field', 'bug', 'awkward', 'other'] as const
export type FeedbackKind = typeof FEEDBACK_KINDS[number]

const submissions = new Map<string, number[]>()

/** Sliding-window per-key limiter. Returns false when the key is over budget. */
export function feedback_rate_allows(key: string, now_ms = Date.now()): boolean {
  const history = (submissions.get(key) ?? []).filter(ts => ts > now_ms - DAY_MS)
  const last_hour = history.filter(ts => ts > now_ms - HOUR_MS).length
  if (last_hour >= MAX_PER_HOUR || history.length >= MAX_PER_DAY) {
    submissions.set(key, history)
    return false
  }
  history.push(now_ms)
  submissions.set(key, history)
  return true
}

/** Test hook — reset the in-memory limiter. */
export function _reset_feedback_limiter(): void {
  submissions.clear()
}

export interface SubmitFeedbackResult {
  thread_id: string
  /** true → appended to an existing open thread (flood cap) rather than a new one. */
  appended: boolean
}

export function submit_agent_feedback({ db, dictionary_id, dictionary_name, key_id, sender, message, kind }: {
  db: Database.Database
  dictionary_id: string
  dictionary_name: string | null
  /** The API key id, for grouping/attribution + the flood cap. */
  key_id: string
  /** The key's creator (snapshotted as the thread sender). */
  sender: { user_id: string | null, email: string, name: string | null }
  message: string
  kind: FeedbackKind
}): SubmitFeedbackResult {
  const now = new Date().toISOString()
  const owner = db.prepare(`SELECT id FROM users WHERE email = ? COLLATE NOCASE LIMIT 1`).get(FEEDBACK_OWNER_EMAIL) as { id: string } | undefined
  const subject = `Agent feedback: ${dictionary_name ?? dictionary_id}`

  const open_from_key = db.prepare(
    `SELECT id FROM message_threads
     WHERE source = ? AND resolved_at IS NULL AND url = ?
     ORDER BY last_message_at DESC`,
  ).all(FEEDBACK_SOURCE, feedback_key_ref(key_id)) as { id: string }[]

  // Flood cap: fold into the newest open thread once the key has too many.
  if (open_from_key.length >= MAX_OPEN_THREADS_PER_KEY) {
    const thread_id = open_from_key[0].id
    append_message({ db, thread_id, sender, message, kind, now })
    db.prepare(`UPDATE message_threads SET last_message_at = ?, updated_at = ? WHERE id = ?`).run(now, now, thread_id)
    return { thread_id, appended: true }
  }

  const thread_id = randomUUID()
  const insert = db.transaction(() => {
    db.prepare(`
      INSERT INTO message_threads (
        id, subject, source, from_user_id, from_email, from_name, url,
        assigned_to_user_id, assigned_at, assigned_by_user_id,
        last_message_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      thread_id,
      subject,
      FEEDBACK_SOURCE,
      sender.user_id,
      sender.email,
      sender.name,
      // `url` carries a stable per-key ref so we can group a key's threads.
      feedback_key_ref(key_id),
      owner?.id ?? null,
      owner ? now : null,
      owner?.id ?? null,
      now,
      now,
      now,
    )
    append_message({ db, thread_id, sender, message, kind, now })
  })
  insert()
  return { thread_id, appended: false }
}

function append_message({ db, thread_id, sender, message, kind, now }: {
  db: Database.Database
  thread_id: string
  sender: { user_id: string | null }
  message: string
  kind: FeedbackKind
  now: string
}): void {
  db.prepare(`
    INSERT INTO messages (id, thread_id, author_user_id, author_kind, body_text, created_at, updated_at)
    VALUES (?, ?, ?, 'agent', ?, ?, ?)
  `).run(randomUUID(), thread_id, sender.user_id, `[${kind}] ${message}`, now, now)
}

function feedback_key_ref(key_id: string): string {
  return `agent-feedback:${key_id}`
}
