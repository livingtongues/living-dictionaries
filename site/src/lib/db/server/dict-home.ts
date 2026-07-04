import type Database from 'better-sqlite3'
import type { MultiString } from '$lib/types'

/**
 * Server-side reads for the dictionary home page (`/[dictionaryId]/home`).
 * Queried in `+page.server.ts` from the server's copy of `dictionaries/{id}.db`
 * so the page paints instantly — the browser's live dict_db takes over once the
 * local snapshot opens. Cheap indexed reads (a handful of rows via subqueries).
 */

export interface DictHomeCard {
  /** `featured_entries.id` for featured cards; the entry id for recent cards. */
  id: string
  entry_id: string
  lexeme: MultiString
  phonetic: string | null
  glosses: MultiString | null
  photo_serving_url: string | null
  audio_storage_path: string | null
}

const CARD_MEDIA_SUBQUERIES = `
  (SELECT s.glosses FROM senses s WHERE s.entry_id = e.id ORDER BY s.created_at LIMIT 1) AS glosses,
  (SELECT p.serving_url FROM senses s
     JOIN sense_photos sp ON sp.sense_id = s.id
     JOIN photos p ON p.id = sp.photo_id
   WHERE s.entry_id = e.id ORDER BY sp.created_at LIMIT 1) AS photo_serving_url,
  (SELECT a.storage_path FROM audio a WHERE a.entry_id = e.id ORDER BY a.created_at LIMIT 1) AS audio_storage_path`

function parse_json_column<T>(value: unknown): T | null {
  if (typeof value !== 'string' || value === '')
    return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function to_card(row: Record<string, unknown>): DictHomeCard {
  return {
    id: row.id as string,
    entry_id: row.entry_id as string,
    lexeme: parse_json_column<MultiString>(row.lexeme) ?? {},
    phonetic: (row.phonetic as string | null) ?? null,
    glosses: parse_json_column<MultiString>(row.glosses),
    photo_serving_url: (row.photo_serving_url as string | null) ?? null,
    audio_storage_path: (row.audio_storage_path as string | null) ?? null,
  }
}

/** Starred entries in strip order (fractional `sort_key`). */
export function get_featured_cards({ db }: { db: Database.Database }): DictHomeCard[] {
  const rows = db.prepare(`
    SELECT fe.id, fe.entry_id, e.lexeme, e.phonetic,${CARD_MEDIA_SUBQUERIES}
    FROM featured_entries fe
    JOIN entries e ON e.id = fe.entry_id
    ORDER BY fe.sort_key`).all() as Record<string, unknown>[]
  return rows.map(to_card)
}

/** Newest entries for the "recently added" strip. */
export function get_recent_cards({ db, limit = 6 }: { db: Database.Database, limit?: number }): DictHomeCard[] {
  const rows = db.prepare(`
    SELECT e.id, e.id AS entry_id, e.lexeme, e.phonetic,${CARD_MEDIA_SUBQUERIES}
    FROM entries e
    ORDER BY e.created_at DESC
    LIMIT ?`).all(limit) as Record<string, unknown>[]
  return rows.map(to_card)
}
