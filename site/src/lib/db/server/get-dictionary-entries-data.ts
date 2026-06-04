import type Database from 'better-sqlite3'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'

/**
 * Project a per-dictionary `dictionaries/{id}.db` into the legacy table arrays
 * the Orama search worker consumes (`entry.worker.ts`). The worker keys these
 * into Records and builds the search index + EntryData — so we return rows in
 * the *legacy supabase shape*: JSON columns parsed (lexeme, glosses, …), soft-
 * deleted rows excluded, and new-schema-only bookkeeping columns dropped so the
 * payload matches what `cached_data_table` used to fetch from Supabase.
 */

// Columns present on the new SQLite schema but absent from the legacy supabase
// rows the worker was written against. Dropped so they don't leak into the
// search index / EntryData `main`.
const DROP_COLUMNS = ['dirty', 'created_by_user_id', 'updated_by_user_id']

const DATA_TABLES = ['entries', 'senses', 'audio', 'speakers', 'tags', 'dialects', 'photos', 'videos', 'sentences'] as const
const JOIN_TABLES = ['audio_speakers', 'entry_tags', 'entry_dialects', 'sense_photos', 'video_speakers', 'sense_videos', 'senses_in_sentences'] as const

export type EntriesDataBundle = Record<string, Record<string, unknown>[]>

function read_table(db: Database.Database, table: string): Record<string, unknown>[] {
  const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table)
  if (!exists)
    return []
  const rows = db.prepare(`SELECT * FROM ${table} WHERE deleted IS NULL`).all() as Record<string, unknown>[]
  for (const row of rows) {
    parse_dict_row(table, row)
    for (const column of DROP_COLUMNS)
      delete row[column]
  }
  return rows
}

/** Read every table the worker needs in one pass; returns arrays keyed by table name. */
export function get_dictionary_entries_data({ db }: { db: Database.Database }): EntriesDataBundle {
  const bundle: EntriesDataBundle = {}
  for (const table of [...DATA_TABLES, ...JOIN_TABLES])
    bundle[table] = read_table(db, table)
  return bundle
}
