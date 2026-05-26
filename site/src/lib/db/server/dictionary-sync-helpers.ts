import type Database from 'better-sqlite3'
import type { Table } from 'drizzle-orm'
import { DICT_JSON_COLUMNS, parse_dict_row, stringify_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import * as dict_schema from '$lib/db/schemas/dictionary'
import { getTableColumns } from 'drizzle-orm'

/**
 * Names of all syncable tables in a dictionary.db. One sector per spec
 * (Q-shared.3 in port-db-sync-architecture.md) — every push/pull processes
 * all 17 tables in this order.
 *
 * Order is FK-safe (parents before children):
 *   entries → senses → senses_in_sentences
 *   sentences (also referenced by senses_in_sentences)
 *   speakers, audio, videos, photos (top-level media)
 *   then junctions
 */
export const DICT_SYNCABLE_TABLES = [
  'entries',
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
export function process_dict_changes({ db, request, user_id, is_editor }: {
  db: Database.Database
  request: DictChangesRequest
  user_id: string
  /** Whether the caller has push permission (editor / manager / admin). */
  is_editor: boolean
}): DictChangesResponse {
  db.pragma('defer_foreign_keys = ON')
  db.exec('BEGIN IMMEDIATE')
  try {
    // PUSH: tombstones (editor only).
    if (is_editor && request.deletes?.length) {
      for (const { table_name, id } of request.deletes) {
        if (!is_dict_syncable_table(table_name))
          continue
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
        for (const row of rows)
          merge_dict_row({ db, table_name, row, user_id })
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

    // PULL: tombstones since cursor.
    if (request.synced_up_to) {
      const tombstones = db.prepare(
        `SELECT table_name, id FROM deletes WHERE updated_at > ? ORDER BY updated_at ASC`,
      ).all(request.synced_up_to) as { table_name: string, id: string }[]
      response.deletes = tombstones
    }

    // New cursor = post-write last_modified_at. The trigger already fired on
    // any pushed row, so this catches up to the latest.
    const lmod = db.prepare(`SELECT value FROM db_metadata WHERE key = 'last_modified_at'`).get() as { value: string } | undefined
    response.new_synced_up_to = lmod?.value ?? (request.synced_up_to ?? new Date(0).toISOString())

    db.exec('COMMIT')
    return response
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function merge_dict_row({ db, table_name, row, user_id }: {
  db: Database.Database
  table_name: DictSyncableTable
  row: Record<string, unknown>
  user_id: string
}) {
  const row_id = row.id as string
  if (!row_id)
    return

  // Last-write-wins by `updated_at` (Story B.4).
  const existing = db.prepare(
    `SELECT updated_at FROM "${table_name}" WHERE id = ?`,
  ).get(row_id) as { updated_at: string } | undefined

  if (existing && (row.updated_at as string) && existing.updated_at > (row.updated_at as string)) {
    // Server wins — caller will see this row come back in the pull stage.
    return
  }

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
}

/** Strip the `.sql` extension for tolerant comparison of migration names. */
export function strip_sql_ext(name: string): string {
  return name.replace(/\.sql$/, '')
}
