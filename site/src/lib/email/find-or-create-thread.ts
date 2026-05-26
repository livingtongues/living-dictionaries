import type Database from 'better-sqlite3'

/**
 * Threading lookup for inbound emails. Tries (in order):
 *   1. RFC `email_references` or `in_reply_to` matches any existing `messages.message_id`
 *   2. Subject heuristic: same `from_email` + matching normalized subject within the last 90 days
 *   3. Otherwise: new thread
 *
 * Stored `message_id` values include angle brackets (e.g. `<abc@livingdictionaries.app>`)
 * so comparison against incoming brackets is direct equality — no stripping needed.
 */

export interface InboundThreadLookup {
  from_email: string
  subject: string | null
  in_reply_to: string | null
  email_references: string[]
}

export interface ThreadResolution {
  thread_id: string
  is_new: boolean
}

/** Strips `Re:`, `Fwd:`, `Fw:`, `Re[2]:`, etc. prefixes (case-insensitive, repeated). */
const RE_PREFIX = /^\s*(?:(?:re|fwd|fw)(?:\s*\[\d+\])?\s*:\s*)+/i

export function normalize_subject(subject: string | null): string {
  if (!subject)
    return ''
  return subject.replace(RE_PREFIX, '').trim()
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

export function find_or_create_thread({ db, lookup, now = new Date() }: {
  db: Database.Database
  lookup: InboundThreadLookup
  /** Override for tests. */
  now?: Date
}): ThreadResolution {
  // 1. RFC header match — most reliable threading signal
  const candidate_ids = [...lookup.email_references, lookup.in_reply_to]
    .filter((id): id is string => !!id)

  if (candidate_ids.length > 0) {
    const placeholders = candidate_ids.map(() => '?').join(', ')
    const match = db.prepare(
      `SELECT thread_id FROM messages
       WHERE message_id IN (${placeholders})
       ORDER BY created_at DESC LIMIT 1`,
    ).get(...candidate_ids) as { thread_id: string } | undefined
    if (match)
      return { thread_id: match.thread_id, is_new: false }
  }

  // 2. Subject heuristic — clients sometimes strip / mangle In-Reply-To. Use
  // normalized subject + same sender + recency as a fallback. Cap the
  // candidate scan at the 20 most recent threads from this email in the last
  // 90 days; effectively zero perf cost.
  const normalized_target = normalize_subject(lookup.subject)
  if (normalized_target) {
    const window_start = new Date(now.getTime() - NINETY_DAYS_MS).toISOString()
    const candidates = db.prepare(
      `SELECT id, subject FROM message_threads
       WHERE from_email = ? COLLATE NOCASE
         AND last_message_at > ?
       ORDER BY last_message_at DESC LIMIT 20`,
    ).all(lookup.from_email, window_start) as { id: string, subject: string | null }[]

    const match = candidates.find(c => normalize_subject(c.subject) === normalized_target)
    if (match)
      return { thread_id: match.id, is_new: false }
  }

  // 3. New thread
  return { thread_id: crypto.randomUUID(), is_new: true }
}

if (import.meta.vitest) {
  describe(normalize_subject, () => {
    test('strips Re: prefix', () => {
      expect(normalize_subject('Re: hello')).toBe('hello')
    })

    test('strips Fwd: prefix', () => {
      expect(normalize_subject('Fwd: hello')).toBe('hello')
    })

    test('strips Fw: prefix (Outlook variant)', () => {
      expect(normalize_subject('Fw: hello')).toBe('hello')
    })

    test('strips bracketed counter Re[2]:', () => {
      expect(normalize_subject('Re[2]: hello')).toBe('hello')
    })

    test('strips repeated prefixes Re: Re: Fwd:', () => {
      expect(normalize_subject('Re: Re: Fwd: hello')).toBe('hello')
    })

    test('case-insensitive: RE: HELLO', () => {
      expect(normalize_subject('RE: HELLO')).toBe('HELLO')
    })

    test('returns empty string for null', () => {
      expect(normalize_subject(null)).toBe('')
    })

    test('trims surrounding whitespace', () => {
      expect(normalize_subject('   hello   ')).toBe('hello')
    })

    test('leaves bare subject untouched', () => {
      expect(normalize_subject('hello world')).toBe('hello world')
    })
  })
}
