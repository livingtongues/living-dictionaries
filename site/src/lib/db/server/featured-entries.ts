import type Database from 'better-sqlite3'
import type { MultiString } from '$lib/types'
import type { FeaturedCard, FeaturedExampleSentence } from '$lib/components/home-v2/types'

/** A `featured_entries` row (server-only table — no Drizzle entry, like the chat/i18n tables). */
export interface FeaturedEntry {
  id: string
  dict_id: string
  entry_id: string
  sense_id: string | null
  photo_id: string | null
  audio_id: string | null
  lexeme: string
  gloss: string | null
  gloss_language: string | null
  photo_serving_url: string
  photo_storage_path: string | null
  audio_storage_path: string
  dict_name: string
  longitude: number | null
  latitude: number | null
  status: FeaturedEntryStatus
  agent_note: string | null
  /** 'agent' = curate-command harvest; 'editor_star' = swept from a dict's starred entries. */
  source: FeaturedEntrySource
  phonetic: string | null
  /** JSON MultiString in the DB — parsed on read. */
  glosses: MultiString | null
  speaker_name: string | null
  /** JSON in the DB — parsed on read. */
  example_sentence: FeaturedExampleSentence | null
  /** dict-db star `created_at` — the editor_star sweep's per-dict watermark. */
  starred_at: string | null
  created_at: string
  updated_at: string
}

export type FeaturedEntryStatus = 'suggested' | 'approved' | 'rejected'
export const FEATURED_ENTRY_STATUSES: FeaturedEntryStatus[] = ['suggested', 'approved', 'rejected']

export type FeaturedEntrySource = 'agent' | 'editor_star'

/** featured_entries is server-only (no Drizzle schema), so JSON columns parse here. */
function parse_featured_row<T>(row: T): T {
  const record = row as Record<string, unknown>
  for (const column of ['glosses', 'example_sentence'] as const) {
    const value = record[column]
    if (typeof value === 'string' && value !== '') {
      try {
        record[column] = JSON.parse(value)
      } catch { /* leave as-is */ }
    }
  }
  return row
}

export function list_featured_entries({ db, status }: { db: Database.Database, status?: FeaturedEntryStatus }): FeaturedEntry[] {
  const rows = status
    ? db.prepare('SELECT * FROM featured_entries WHERE status = ? ORDER BY created_at DESC').all(status) as FeaturedEntry[]
    : db.prepare('SELECT * FROM featured_entries ORDER BY created_at DESC').all() as FeaturedEntry[]
  return rows.map(parse_featured_row)
}

export function set_featured_entry_status({ db, ids, status }: { db: Database.Database, ids: string[], status: FeaturedEntryStatus }): number {
  const update = db.prepare(`UPDATE featured_entries SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`)
  let changed = 0
  const run_all = db.transaction(() => {
    for (const id of ids)
      changed += update.run(status, id).changes
  })
  run_all()
  return changed
}

/** Approved cards joined with the live catalog for the current url slug (homepage bake shape). */
export function approved_featured_cards({ db }: { db: Database.Database }): FeaturedCard[] {
  const rows = db.prepare(`
    SELECT fe.id, fe.dict_id, COALESCE(d.url, fe.dict_id) AS dict_url, fe.dict_name, d.location AS dict_location, fe.entry_id,
      fe.lexeme, fe.gloss, fe.gloss_language, fe.photo_serving_url, fe.photo_storage_path, fe.audio_storage_path,
      fe.phonetic, fe.glosses, fe.speaker_name, fe.example_sentence,
      fe.longitude AS lng, fe.latitude AS lat
    FROM featured_entries fe
    LEFT JOIN dictionaries d ON d.id = fe.dict_id
    WHERE fe.status = 'approved'
    ORDER BY fe.created_at`).all() as (FeaturedCard & Record<string, unknown>)[]
  return rows.map(parse_featured_row)
}
