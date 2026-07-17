import type Database from 'better-sqlite3'
import { html_to_text } from '$lib/utils/html-to-text'
import { resolve_page_context } from './resolve-url'

/**
 * Read-only assembly of everything the classifier needs, gathered SERVER-SIDE
 * (this is where "read-only" actually lives — we run the queries; Grok only
 * sees the text we hand it).
 *
 * LD has no Stripe/billing. Instead of subscription facts we hand the model the
 * sender's relationship to Living Dictionaries: which dictionaries they have a
 * role on (or created), how big those are, and how many prior threads they've
 * sent — enough to judge whether this is a contributor needing access, a
 * manager hitting a bug, or a stranger.
 */

export interface TriageMessageContext {
  author: 'customer' | 'admin' | 'agent'
  at: string
  text: string
}

export interface TriageDictionaryContext {
  name: string
  /** 'manager' | 'contributor' | 'owner' (owner = they created it). */
  role: string
  entry_count: number
  is_public: boolean
}

export interface TriageContext {
  subject: string | null
  from_name: string | null
  from_email: string
  /** Which `*@livingdictionaries.app` alias they wrote to (catch-all), if email. */
  to_email: string | null
  /** True when the sender matches a known `users` row. */
  is_known_customer: boolean
  /** Human-readable page they were on, resolved from the thread URL. */
  page_context: string | null
  /** Raw thread URL (already shown to admins; included for the model too). */
  url: string | null
  /** Dictionaries the sender has a role on or created, newest activity first. */
  dictionaries: TriageDictionaryContext[]
  /** How many OTHER threads this sender has opened before (excludes this one). */
  prior_thread_count: number
  /** The full thread, oldest → newest. */
  messages: TriageMessageContext[]
}

interface ThreadRow {
  subject: string | null
  from_name: string | null
  from_email: string
  from_user_id: string | null
  to_email: string | null
  url: string | null
}

interface MessageRow {
  author_kind: 'customer' | 'admin' | 'agent'
  body_text: string | null
  body_html: string | null
  created_at: string
}

function message_text(row: MessageRow): string {
  if (row.body_text?.trim())
    return row.body_text.trim()
  if (row.body_html?.trim())
    return html_to_text(row.body_html).trim()
  return ''
}

function build_dictionaries({ db, user_id }: { db: Database.Database, user_id: string }): TriageDictionaryContext[] {
  const by_id = new Map<string, TriageDictionaryContext>()

  const role_rows = db.prepare(`
    SELECT d.id AS id, d.name AS name, d.entry_count AS entry_count,
           d.public AS public, dr.role AS role
    FROM dictionary_roles dr
    JOIN dictionaries d ON d.id = dr.dictionary_id
    WHERE dr.user_id = ?
    ORDER BY d.updated_at DESC
  `).all(user_id) as { id: string, name: string, entry_count: number, public: number | null, role: string }[]
  for (const row of role_rows) {
    by_id.set(row.id, {
      name: row.name,
      role: row.role,
      entry_count: row.entry_count ?? 0,
      is_public: !!row.public,
    })
  }

  const owned_rows = db.prepare(`
    SELECT id, name, entry_count, public
    FROM dictionaries
    WHERE created_by_user_id = ?
    ORDER BY updated_at DESC
  `).all(user_id) as { id: string, name: string, entry_count: number, public: number | null }[]
  for (const row of owned_rows) {
    if (!by_id.has(row.id)) {
      by_id.set(row.id, {
        name: row.name,
        role: 'owner',
        entry_count: row.entry_count ?? 0,
        is_public: !!row.public,
      })
    }
  }

  return [...by_id.values()]
}

export function build_triage_context({ db, thread_id }: { db: Database.Database, thread_id: string }): TriageContext | null {
  const thread = db.prepare(`
    SELECT subject, from_name, from_email, from_user_id, to_email, url
    FROM message_threads WHERE id = ?
  `).get(thread_id) as ThreadRow | undefined
  if (!thread)
    return null

  const message_rows = db.prepare(`
    SELECT author_kind, body_text, body_html, created_at
    FROM messages WHERE thread_id = ? ORDER BY created_at ASC
  `).all(thread_id) as MessageRow[]

  const dictionaries = thread.from_user_id
    ? build_dictionaries({ db, user_id: thread.from_user_id })
    : []

  const prior = db.prepare(`
    SELECT COUNT(*) AS count FROM message_threads
    WHERE from_email = ? COLLATE NOCASE AND id != ?
  `).get(thread.from_email, thread_id) as { count: number }
  const prior_thread_count = prior?.count ?? 0

  return {
    subject: thread.subject,
    from_name: thread.from_name,
    from_email: thread.from_email,
    to_email: thread.to_email,
    is_known_customer: !!thread.from_user_id,
    page_context: resolve_page_context({ url: thread.url, db }),
    url: thread.url,
    dictionaries,
    prior_thread_count,
    messages: message_rows.map(row => ({
      author: row.author_kind,
      at: row.created_at,
      text: message_text(row),
    })),
  }
}
