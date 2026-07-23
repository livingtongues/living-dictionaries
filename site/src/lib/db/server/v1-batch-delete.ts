import type Database from 'better-sqlite3'
import type { HistoryEvent } from './dictionary-history-db'
import { read_last_modified_at } from './dictionary-db'
import { record_history } from './dictionary-history-db'
import { delete_dict_row } from './dictionary-sync-helpers'

/**
 * Batch delete every entry from one bulk import, found via the private tag named
 * after the batch's `import_id` (created by `apply_entry_writes`). Deletes are
 * tombstones (`deletes` rows → `process_delete_cascade` FK-cascades senses and
 * junctions and propagates to peers + the snapshot builder — NEVER raw DELETE).
 * The now-empty private tag is tombstoned too. Orphaned standalone example
 * sentences created by the import are deliberately LEFT in place (v1 decision).
 */

const DELETE_CHUNK_SIZE = 500

export interface ImportBatchScope {
  tag_id: string | null
  entry_ids: string[]
}

function name_key(name: string): string {
  return name.trim().toLowerCase()
}

/** Resolve an import_id to its private tag + the entries linked to it. */
export function find_import_batch(db: Database.Database, import_id: string): ImportBatchScope {
  const key = name_key(import_id)
  if (!key)
    return { tag_id: null, entry_ids: [] }
  const tags = db.prepare(`SELECT id, name FROM tags WHERE private = 1 ORDER BY created_at`).all() as { id: string, name: string }[]
  const tag = tags.find(row => name_key(row.name ?? '') === key)
  if (!tag)
    return { tag_id: null, entry_ids: [] }
  const rows = db.prepare(
    `SELECT DISTINCT entries.id FROM entries
     JOIN entry_tags ON entry_tags.entry_id = entries.id
     WHERE entry_tags.tag_id = ? ORDER BY entries.created_at`,
  ).all(tag.id) as { id: string }[]
  return { tag_id: tag.id, entry_ids: rows.map(row => row.id) }
}

export interface ImportBatchDeleteResult {
  deleted_count: number
  tag_deleted: boolean
  cursor: string | null
}

/**
 * Tombstone-delete the batch in chunked transactions (write amplification), then
 * the private tag itself. History (`delete` events with before-images) is
 * recorded per chunk, exactly like an editor's deletes.
 */
export function apply_import_batch_delete({ db, history_db, tag_id, entry_ids, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  tag_id: string
  entry_ids: string[]
  user_id: string
  api_key_id?: string | null
}): ImportBatchDeleteResult {
  const now = new Date().toISOString()
  let deleted_count = 0
  let tag_deleted = false

  function run_chunk(deletes: { table_name: 'entries' | 'tags', id: string }[]) {
    const chunk_history: HistoryEvent[] = []
    db.exec('BEGIN IMMEDIATE')
    try {
      for (const { table_name, id } of deletes) {
        const { deleted, event } = delete_dict_row({ db, table_name, id, user_id, at: now, api_key_id })
        if (deleted) {
          if (table_name === 'tags')
            tag_deleted = true
          else
            deleted_count++
        }
        if (event)
          chunk_history.push(event)
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    if (history_db && chunk_history.length) {
      try {
        record_history(history_db, chunk_history)
      } catch (err) {
        console.warn('Could not record v1 batch-delete history:', err)
      }
    }
  }

  for (let start = 0; start < entry_ids.length; start += DELETE_CHUNK_SIZE)
    run_chunk(entry_ids.slice(start, start + DELETE_CHUNK_SIZE).map(id => ({ table_name: 'entries' as const, id })))
  run_chunk([{ table_name: 'tags', id: tag_id }])

  return { deleted_count, tag_deleted, cursor: read_last_modified_at(db) }
}
