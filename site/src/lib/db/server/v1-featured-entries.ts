import type Database from 'better-sqlite3'
import type { HistoryEvent } from './dictionary-history-db'
import type { SingleWriteResult } from './v1-entry-write'
import { initial_keys, key_between } from '$lib/api/v1/fractional-index'
import { read_last_modified_at } from './dictionary-db'
import { record_history } from './dictionary-history-db'
import { merge_dict_row } from './dictionary-sync-helpers'
import { run_tombstone_delete } from './v1-entry-write'

/**
 * `/api/v1` FEATURED ENTRIES sub-resource: the dict.db `featured_entries` table
 * (editor-starred favorites shown on the dictionary home strip, ordered by a
 * fractional `sort_key`). Agent parity for the human star toggle on the entry
 * action bar — writes go through `merge_dict_row` / tombstone deletes, the same
 * validated path + history as a browser push. NOT shared.db's global homepage
 * bucket of the same name.
 */

export interface FeaturedEntryRecord {
  /** The `featured_entries` row id (sync/tombstone identity). */
  id: string
  entry_id: string
  sort_key: string
}

function commit_history(history_db: Database.Database | undefined, event: HistoryEvent | null) {
  if (history_db && event) {
    try {
      record_history(history_db, [event])
    } catch (err) {
      console.warn('Could not record v1 featured-entry history:', err)
    }
  }
}

/** Starred entries in strip order. */
export function list_featured_entries(db: Database.Database): FeaturedEntryRecord[] {
  return db.prepare(`SELECT id, entry_id, sort_key FROM featured_entries ORDER BY sort_key`).all() as FeaturedEntryRecord[]
}

export interface StarEntryResult {
  featured_entry: FeaturedEntryRecord
  /** false → the entry was already starred (idempotent no-op). */
  created: boolean
  cursor: string | null
}

/**
 * Star an entry (append to the end of the strip). Idempotent: re-starring
 * returns the existing row with `created: false`. Throws if the entry id is
 * unknown (caller maps to 404).
 */
export function star_entry({ db, history_db, entry_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  entry_id: string
  user_id: string
  api_key_id?: string | null
}): StarEntryResult {
  const entry = db.prepare(`SELECT id FROM entries WHERE id = ?`).get(entry_id) as { id: string } | undefined
  if (!entry)
    throw new EntryNotFoundError(entry_id)

  const existing = db.prepare(`SELECT id, entry_id, sort_key FROM featured_entries WHERE entry_id = ?`).get(entry_id) as FeaturedEntryRecord | undefined
  if (existing)
    return { featured_entry: existing, created: false, cursor: read_last_modified_at(db) }

  const last = db.prepare(`SELECT sort_key FROM featured_entries ORDER BY sort_key DESC LIMIT 1`).get() as { sort_key: string } | undefined
  const now = new Date().toISOString()
  const row: FeaturedEntryRecord = { id: crypto.randomUUID(), entry_id, sort_key: key_between(last?.sort_key ?? null, null) }
  const event = merge_dict_row({ db, table_name: 'featured_entries', row: { ...row, created_at: now, updated_at: now }, user_id, at: now, api_key_id })
  commit_history(history_db, event)
  return { featured_entry: row, created: true, cursor: read_last_modified_at(db) }
}

export class EntryNotFoundError extends Error {
  constructor(entry_id: string) {
    super(`entry ${entry_id} not found`)
  }
}

/** Unstar by ENTRY id (the natural key — one star per entry). */
export function unstar_entry({ db, history_db, entry_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  entry_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const existing = db.prepare(`SELECT id FROM featured_entries WHERE entry_id = ?`).get(entry_id) as { id: string } | undefined
  if (!existing)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  return run_tombstone_delete({ db, history_db, table_name: 'featured_entries', id: existing.id, user_id, api_key_id })
}

export interface ReorderFeaturedResult {
  featured_entries: FeaturedEntryRecord[]
  cursor: string | null
}

/**
 * Reassign the WHOLE strip order: `order` must list every currently-starred
 * entry id exactly once (mirrors v1-texts `sentence_order`). Fresh evenly-spread
 * sort_keys are written in the given order.
 */
export function reorder_featured_entries({ db, history_db, order, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  order: string[]
  user_id: string
  api_key_id?: string | null
}): ReorderFeaturedResult {
  // Full rows: merge_dict_row upserts via INSERT … ON CONFLICT, so a partial
  // row would trip NOT NULL constraints (created_at / created_by_user_id).
  const current = db.prepare(`SELECT * FROM featured_entries ORDER BY sort_key`).all() as Record<string, unknown>[]
  const by_entry_id = new Map(current.map(row => [row.entry_id as string, row]))
  if (order.length !== current.length || new Set(order).size !== order.length)
    throw new Error(`order must list every starred entry id exactly once (${current.length} starred, got ${order.length})`)
  for (const entry_id of order) {
    if (!by_entry_id.has(entry_id))
      throw new Error(`entry ${entry_id} is not starred`)
  }

  const now = new Date().toISOString()
  const keys = initial_keys(order.length)
  const events: HistoryEvent[] = []
  db.exec('BEGIN IMMEDIATE')
  try {
    order.forEach((entry_id, index) => {
      const row: Record<string, unknown> = { ...by_entry_id.get(entry_id), sort_key: keys[index], updated_at: now }
      delete row.updated_by_user_id
      delete row.dirty
      const event = merge_dict_row({ db, table_name: 'featured_entries', row, user_id, at: now, api_key_id })
      if (event)
        events.push(event)
    })
    const cursor = read_last_modified_at(db)
    db.exec('COMMIT')
    if (history_db && events.length) {
      try {
        record_history(history_db, events)
      } catch (err) {
        console.warn('Could not record v1 featured-entry history:', err)
      }
    }
    return { featured_entries: list_featured_entries(db), cursor }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
