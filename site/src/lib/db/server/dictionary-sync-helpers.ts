import type Database from 'better-sqlite3'
import type { Table } from 'drizzle-orm'
import type { HistoryEvent } from './dictionary-history-db'
import { parse_dict_row, stringify_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import * as dict_schema from '$lib/db/schemas/dictionary'
import { getTableColumns } from 'drizzle-orm'
import { build_delta, build_snapshot, resolve_owners } from './dictionary-history-capture'
import { record_history } from './dictionary-history-db'

/**
 * Names of all syncable tables in a dictionary.db. One sector per spec
 * (Q-shared.3 in port-db-sync-architecture.md) — every push/pull processes
 * all 18 tables in this order.
 *
 * Order is FK-safe (parents before children):
 *   entries, texts → senses → senses_in_sentences
 *   sentences (references texts; also referenced by senses_in_sentences)
 *   speakers, audio, videos, photos (top-level media; audio/videos reference texts)
 *   then junctions
 */
export const DICT_SYNCABLE_TABLES = [
  'entries',
  'texts',
  'sentences',
  'senses',
  'senses_in_sentences',
  'speakers',
  'audio',
  'audio_speakers',
  'videos',
  'video_speakers',
  'sense_videos',
  'sentence_videos',
  'photos',
  'sense_photos',
  'sentence_photos',
  'dialects',
  'entry_dialects',
  'tags',
  'entry_tags',
] as const

export type DictSyncableTable = typeof DICT_SYNCABLE_TABLES[number]

const VALID_COLUMNS: Record<DictSyncableTable, Set<string>> = Object.fromEntries(
  DICT_SYNCABLE_TABLES.map(name => [
    name,
    new Set(Object.keys(getTableColumns(dict_schema[name] as Table))),
  ]),
) as Record<DictSyncableTable, Set<string>>

export interface DictChangesRequest {
  /** Client's last-seen `db_metadata.last_modified_at`. null = first sync. */
  synced_up_to: string | null
  /** Per-table dirty rows. Editors only — viewers send nothing. */
  dirty_rows?: Partial<Record<DictSyncableTable, Record<string, unknown>[]>>
  /** Tombstones to apply. Editors only. */
  deletes?: { table_name: string, id: string }[]
  /** Bundled migration filename (Q10.3 — for schema_outdated detection). */
  latest_dict_migration: string
}

export interface DictChangesResponse {
  new_synced_up_to: string
  changes: Partial<Record<DictSyncableTable, Record<string, unknown>[]>>
  deletes: { table_name: string, id: string }[]
}

export interface DictSyncErrors {
  schema_outdated?: { client_has: string, server_has: string }
  server_outdated?: { client_has: string, server_has: string }
  snapshot_expired?: { gap_days: number }
}

export function is_dict_syncable_table(table: string): table is DictSyncableTable {
  return (DICT_SYNCABLE_TABLES as readonly string[]).includes(table)
}

/**
 * Apply a client's dirty rows + tombstones, then fetch deltas since the
 * client's cursor. All wrapped in a single transaction.
 *
 * Conflict resolution: last-write-wins by `updated_at` (Story B.4).
 * Returns the post-write `db_metadata.last_modified_at` as the new cursor.
 *
 * The caller (endpoint handler) is responsible for:
 *   - migration version handshake (`schema_outdated` / `server_outdated`)
 *   - snapshot_expired check (cursor > 60 days behind)
 *   - role lookup (verify the user can write)
 *   - mirroring `last_modified_at` to `shared.db.dictionaries.updated_at`
 *
 * This function is push+pull in one atomic round-trip.
 */
export function process_dict_changes({ db, request, user_id, is_editor, history_db }: {
  db: Database.Database
  request: DictChangesRequest
  user_id: string
  /** Whether the caller has push permission (editor / manager / admin). */
  is_editor: boolean
  /**
   * Separate per-dict history db. When provided, recorded change events are
   * appended AFTER the main-db commit (best-effort — see dictionary-history-db).
   * Omitted in unit tests that don't assert history.
   */
  history_db?: Database.Database
}): DictChangesResponse {
  // Server receive time — one stamp shared by every event in this push batch.
  const history_at = new Date().toISOString()
  const history_events: HistoryEvent[] = []

  db.pragma('defer_foreign_keys = ON')
  db.exec('BEGIN IMMEDIATE')
  try {
    // PUSH: tombstones (editor only).
    if (is_editor && request.deletes?.length) {
      for (const { table_name, id } of request.deletes) {
        if (!is_dict_syncable_table(table_name))
          continue
        // Capture the pre-delete image + owners BEFORE the cascade wipes it.
        const image = db.prepare(`SELECT * FROM "${table_name}" WHERE id = ?`).get(id) as Record<string, unknown> | undefined
        if (image) {
          history_events.push({
            table_name,
            row_id: id,
            op: 'delete',
            user_id,
            at: history_at,
            snapshot: build_snapshot(table_name, image),
            delta: null,
            owners: resolve_owners(db, table_name, image),
          })
        }
        db.prepare(
          `INSERT OR REPLACE INTO deletes (table_name, id, updated_at)
           VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        ).run(table_name, id)
      }
    }

    // PUSH: dirty rows (editor only).
    if (is_editor && request.dirty_rows) {
      for (const table_name of DICT_SYNCABLE_TABLES) {
        const rows = request.dirty_rows[table_name]
        if (!rows?.length)
          continue
        for (const row of rows) {
          const event = merge_dict_row({ db, table_name, row, user_id, at: history_at })
          if (event)
            history_events.push(event)
        }
      }
    }

    // PULL: rows updated since cursor (filter out rows we just wrote).
    const response: DictChangesResponse = {
      new_synced_up_to: '',
      changes: {},
      deletes: [],
    }

    const uploaded_keys = new Set<string>()
    if (request.dirty_rows) {
      for (const table_name of DICT_SYNCABLE_TABLES) {
        for (const row of request.dirty_rows[table_name] ?? [])
          uploaded_keys.add(`${table_name}::${(row as { id: string }).id}`)
      }
    }

    for (const table_name of DICT_SYNCABLE_TABLES) {
      const where_sql = request.synced_up_to ? `WHERE updated_at > ?` : ''
      const params = request.synced_up_to ? [request.synced_up_to] : []
      const rows = db.prepare(
        `SELECT * FROM "${table_name}" ${where_sql} ORDER BY updated_at ASC`,
      ).all(...params) as Record<string, unknown>[]
      for (const row of rows)
        parse_dict_row(table_name, row)
      const filtered = rows.filter(row => !uploaded_keys.has(`${table_name}::${row.id}`))
      if (filtered.length)
        response.changes[table_name] = filtered
    }

    // PULL: tombstones since cursor. Skip any whose row currently exists — it
    // was re-created (same id) after the delete, so forwarding the tombstone
    // would wrongly delete the live row on peers.
    if (request.synced_up_to) {
      const tombstones = db.prepare(
        `SELECT table_name, id FROM deletes WHERE updated_at > ? ORDER BY updated_at ASC`,
      ).all(request.synced_up_to) as { table_name: string, id: string }[]
      for (const tombstone of tombstones) {
        if (!is_dict_syncable_table(tombstone.table_name))
          continue
        const exists = db.prepare(`SELECT 1 FROM "${tombstone.table_name}" WHERE id = ?`).get(tombstone.id)
        if (!exists)
          response.deletes.push(tombstone)
      }
    }

    // New cursor = post-write last_modified_at. The trigger already fired on
    // any pushed row, so this catches up to the latest.
    const lmod = db.prepare(`SELECT value FROM db_metadata WHERE key = 'last_modified_at'`).get() as { value: string } | undefined
    response.new_synced_up_to = lmod?.value ?? (request.synced_up_to ?? new Date(0).toISOString())

    db.exec('COMMIT')

    // Append history AFTER the main-db commit. Best-effort: a failure here
    // (or a crash in this window) must never roll back or 500 the real edit.
    if (history_db && history_events.length) {
      try {
        record_history(history_db, history_events)
      } catch (err) {
        console.warn('Could not record change history:', err)
      }
    }

    return response
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function merge_dict_row({ db, table_name, row, user_id, at }: {
  db: Database.Database
  table_name: DictSyncableTable
  row: Record<string, unknown>
  user_id: string
  /** Batch history timestamp; when set, returns a HistoryEvent to record. */
  at?: string
}): HistoryEvent | null {
  const row_id = row.id as string
  if (!row_id)
    return null

  // Full existing row: needed for the LWW check AND the history delta.
  const existing = db.prepare(
    `SELECT * FROM "${table_name}" WHERE id = ?`,
  ).get(row_id) as Record<string, unknown> | undefined

  if (existing && (row.updated_at as string) && (existing.updated_at as string) > (row.updated_at as string)) {
    // Server wins — caller will see this row come back in the pull stage.
    // Nothing changed, so no history.
    return null
  }

  const op: 'insert' | 'update' = existing ? 'update' : 'insert'
  const delta = at ? build_delta(table_name, existing, row) : null

  // Stamp updated_by_user_id with the authenticated caller (server is the
  // authority on this). created_by_user_id is preserved if the row already
  // exists; otherwise it's stamped with the caller too.
  const stringified = stringify_dict_row(table_name, { ...row })
  const allowed = VALID_COLUMNS[table_name]
  const columns = Object.keys(stringified).filter(c => c !== 'dirty' && allowed.has(c))
  if (!columns.includes('updated_by_user_id')) {
    columns.push('updated_by_user_id')
    stringified.updated_by_user_id = user_id
  }
  if (!existing && !columns.includes('created_by_user_id')) {
    columns.push('created_by_user_id')
    stringified.created_by_user_id = user_id
  }

  const placeholders = columns.map(() => '?').join(', ')
  const update_set = columns
    .filter(c => c !== 'id' && c !== 'created_at' && c !== 'created_by_user_id')
    .map(c => `"${c}" = excluded."${c}"`)
    .join(', ')
  const values = columns.map(c => stringified[c]) as (string | number | null)[]

  db.prepare(
    `INSERT INTO "${table_name}" (${columns.map(c => `"${c}"`).join(', ')})
     VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${update_set}`,
  ).run(...values)

  if (!at)
    return null
  // Record genuine changes only: inserts always; updates only when a content
  // column actually changed (an updated_at-only re-push yields a null delta).
  if (op === 'update' && !delta)
    return null
  const after = db.prepare(`SELECT * FROM "${table_name}" WHERE id = ?`).get(row_id) as Record<string, unknown>
  return {
    table_name,
    row_id,
    op,
    user_id,
    at,
    snapshot: build_snapshot(table_name, after),
    delta,
    owners: resolve_owners(db, table_name, after),
  }
}

/** Strip the `.sql` extension for tolerant comparison of migration names. */
export function strip_sql_ext(name: string): string {
  return name.replace(/\.sql$/, '')
}
