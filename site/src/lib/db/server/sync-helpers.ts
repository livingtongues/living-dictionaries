import type { SyncableTableName, SyncRequest, SyncResponse, SyncRow } from '$lib/db/sync/types'
import type Database from 'better-sqlite3'
import type { Table } from 'drizzle-orm'
import { stringify_row } from '$lib/db/schemas/json-columns'
import * as schema from '$lib/db/schemas/shared'
import { CLIENT_BEHIND, SERVER_BEHIND, SyncVersionError } from '$lib/db/sync/errors'
import { is_readonly_table, is_syncable_table, SYNCABLE_TABLE_NAMES } from '$lib/db/sync/types'
import { getTableColumns } from 'drizzle-orm'
import { latest_shared_migration_name } from './shared-db'
import { query_all, query_one } from './typed-query'

/**
 * Derived per-table column allowlist so schema additions/renames flow through
 * automatically. Keys are pinned to `SyncableTableName` at compile time.
 */
const VALID_COLUMNS: Record<SyncableTableName, Set<string>> = Object.fromEntries(
  SYNCABLE_TABLE_NAMES.map(name => [
    name,
    new Set(Object.keys(getTableColumns(schema[name] as Table))),
  ]),
) as Record<SyncableTableName, Set<string>>

/** Primary key column for each syncable table. */
const PRIMARY_KEY: Record<SyncableTableName, string> = {
  users: 'id',
  dictionaries: 'id',
  dictionary_roles: 'id',
  invites: 'id',
  message_threads: 'id',
  messages: 'id',
  message_attachments: 'id',
}

/**
 * Process an admin-sync round trip (push + pull) in a single transaction.
 *
 * LD uses one sector (per Q-shared.3), so this is simpler than house's
 * 3-sector design: iterate `SYNCABLE_TABLE_NAMES` in order, accept dirty rows
 * + tombstones, then return rows updated since the client's watermark.
 */
export function process_sync({ db, request, user_id, server_latest_migration = latest_shared_migration_name }: {
  db: Database.Database
  request: SyncRequest
  /**
   * Authenticated admin's user_id. Used to scope the once-per-day
   * `update_last_visit` ping.
   */
  user_id?: string
  server_latest_migration?: string
}): SyncResponse {
  // Migration version handshake. Filenames are date-prefixed and sort
  // lexicographically. Strip the `.sql` extension for tolerance.
  const client_normalized = strip_sql_ext(request.latest_migration)
  const server_normalized = strip_sql_ext(server_latest_migration)
  if (client_normalized !== server_normalized) {
    throw new SyncVersionError({
      code: client_normalized < server_normalized ? CLIENT_BEHIND : SERVER_BEHIND,
      client_latest: request.latest_migration,
      server_latest: server_latest_migration,
    })
  }

  db.pragma('defer_foreign_keys = ON')
  db.exec('BEGIN IMMEDIATE')

  try {
    const response: SyncResponse = {
      new_synced_up_to: null,
      changes: {},
      deletes: [],
    }

    // Process incoming deletes.
    for (const { table_name, id } of request.deletes) {
      if (!is_syncable_table(table_name))
        continue
      if (is_readonly_table(table_name))
        continue
      db.prepare(
        `INSERT OR REPLACE INTO deletes (table_name, id, updated_at)
         VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      ).run(table_name, id)
    }

    // Process incoming dirty rows.
    for (const table_name of SYNCABLE_TABLE_NAMES) {
      if (is_readonly_table(table_name))
        continue
      const rows = request.dirty_rows[table_name]
      if (!rows?.length)
        continue
      for (const row of rows)
        merge_row({ db, table_name, row, response })
    }

    // Once-per-day visit ping. Runs BEFORE fetch_changes so the
    // trigger-bumped `updated_at` flows into the same response.
    if (request.update_last_visit && user_id) {
      db.prepare(
        `UPDATE users SET last_visit_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      ).run(user_id)
    }

    // Fetch server changes since watermark.
    for (const table_name of SYNCABLE_TABLE_NAMES) {
      const rows = fetch_changes({ db, table_name, synced_up_to: request.synced_up_to })

      // Exclude rows we just merged from the client (they'd show up as "changes" otherwise).
      const uploaded_ids = new Set(
        (request.dirty_rows[table_name] ?? []).map(row => row_key_of(table_name, row)),
      )
      let filtered = rows.filter(row => !uploaded_ids.has(row_key_of(table_name, row)))
      filtered = filtered.map(row => strip_unknown_columns(table_name, row))

      if (filtered.length > 0) {
        const existing = response.changes[table_name]
        if (existing)
          (existing as SyncRow<typeof table_name>[]).push(...filtered)
        else
          (response.changes[table_name] as SyncRow<typeof table_name>[]) = filtered
      }
    }

    // Fetch server-side deletes since watermark. Skip ones where the row was
    // since re-added (rare).
    if (request.synced_up_to) {
      for (const table_name of SYNCABLE_TABLE_NAMES) {
        const deletes = db.prepare(
          `SELECT table_name, id FROM deletes WHERE table_name = ? AND updated_at > ?`,
        ).all(table_name, request.synced_up_to) as { table_name: string, id: string }[]

        for (const del of deletes) {
          const exists = db.prepare(`SELECT 1 FROM "${table_name}" WHERE "${PRIMARY_KEY[table_name]}" = ?`).get(del.id)
          if (!exists)
            response.deletes.push(del)
        }
      }
    }

    response.new_synced_up_to = compute_max_updated_at({ db, tables: SYNCABLE_TABLE_NAMES })

    db.exec('COMMIT')
    return response
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function fetch_changes<K extends SyncableTableName>({ db, table_name, synced_up_to }: {
  db: Database.Database
  table_name: K
  synced_up_to: string | null
}): SyncRow<K>[] {
  const where_sql = synced_up_to ? `WHERE updated_at > ?` : ''
  return query_all<SyncRow<K>>({
    db,
    table: table_name,
    sql: `SELECT * FROM "${table_name}" ${where_sql} ORDER BY updated_at ASC`,
    params: synced_up_to ? [synced_up_to] : [],
  })
}

/**
 * Drop columns the current schema doesn't know about. Guards against stale
 * server tables that still carry e.g. `dirty` after an in-place migration
 * edit removed the column.
 */
function strip_unknown_columns<K extends SyncableTableName>(table_name: K, row: SyncRow<K>): SyncRow<K> {
  const allowed = VALID_COLUMNS[table_name]
  const source = row as unknown as Record<string, unknown>
  const copy: Record<string, unknown> = {}
  for (const key of Object.keys(source)) {
    if (allowed.has(key))
      copy[key] = source[key]
  }
  return copy as unknown as SyncRow<K>
}

function row_key_of<K extends SyncableTableName>(table_name: K, row: SyncRow<K>): string {
  const pk = PRIMARY_KEY[table_name]
  return (row as unknown as Record<string, string>)[pk]
}

function merge_row<K extends SyncableTableName>({ db, table_name, row, response }: {
  db: Database.Database
  table_name: K
  row: SyncRow<K>
  response: SyncResponse
}) {
  const pk = PRIMARY_KEY[table_name]
  const row_id = (row as unknown as Record<string, string>)[pk]
  const existing = db.prepare(
    `SELECT updated_at FROM "${table_name}" WHERE "${pk}" = ?`,
  ).get(row_id) as { updated_at: string } | undefined

  if (existing && existing.updated_at > (row as unknown as { updated_at: string }).updated_at) {
    // Server wins — add server's full row (parsed) to response changes.
    const server_row = query_one<SyncRow<K>>({
      db,
      table: table_name,
      sql: `SELECT * FROM "${table_name}" WHERE "${pk}" = ?`,
      params: [row_id],
    })
    if (!server_row)
      return
    const existing_changes = response.changes[table_name]
    if (existing_changes)
      (existing_changes as SyncRow<K>[]).push(server_row)
    else
      (response.changes[table_name] as SyncRow<K>[]) = [server_row]
    return
  }

  // Client wins — upsert (only allow known columns; stringify JSON cols).
  const allowed = VALID_COLUMNS[table_name]
  const stringified = stringify_row(table_name, { ...(row as unknown as Record<string, unknown>) })
  const columns = Object.keys(stringified).filter(c => c !== 'dirty' && allowed.has(c))
  const placeholders = columns.map(() => '?').join(', ')
  const update_set = columns
    .filter(c => c !== pk)
    .map(c => `"${c}" = excluded."${c}"`)
    .join(', ')

  const values = columns.map(c => stringified[c]) as (string | number | null)[]

  db.prepare(
    `INSERT INTO "${table_name}" (${columns.map(c => `"${c}"`).join(', ')})
     VALUES (${placeholders})
     ON CONFLICT(${pk}) DO UPDATE SET ${update_set}`,
  ).run(...values)
}

function strip_sql_ext(migration_name: string): string {
  return migration_name.replace(/\.sql$/, '')
}

function compute_max_updated_at({ db, tables }: { db: Database.Database, tables: readonly SyncableTableName[] }): string | null {
  let max: string | null = null
  for (const table of tables) {
    const result = db.prepare(`SELECT MAX(updated_at) as max_ts FROM "${table}"`).get() as { max_ts: string | null }
    if (result.max_ts && (!max || result.max_ts > max))
      max = result.max_ts
  }
  return max
}

if (import.meta.vitest) {
  describe(strip_sql_ext, () => {
    test('strips a trailing .sql', () => {
      expect(strip_sql_ext('20260525_initial.sql')).toBe('20260525_initial')
    })

    test('leaves a name without extension untouched', () => {
      expect(strip_sql_ext('20260525_initial')).toBe('20260525_initial')
    })
  })

  describe('VALID_COLUMNS', () => {
    test('users columns', () => {
      expect(VALID_COLUMNS.users).toEqual(new Set(['id', 'email', 'name', 'avatar_url', 'providers', 'unsubscribed_from_emails', 'preferred_locale', 'last_visit_at', 'created_at', 'updated_at']))
    })
    test('dictionaries columns include catalog + bookkeeping', () => {
      expect(VALID_COLUMNS.dictionaries.has('id')).toBe(true)
      expect(VALID_COLUMNS.dictionaries.has('snapshot_uploaded_at')).toBe(true)
      expect(VALID_COLUMNS.dictionaries.has('dict_db_schema_version')).toBe(true)
      expect(VALID_COLUMNS.dictionaries.has('dirty')).toBe(true)
    })
    test('dictionary_roles columns', () => {
      expect(VALID_COLUMNS.dictionary_roles).toEqual(new Set(['id', 'dictionary_id', 'user_id', 'role', 'invited_by_user_id', 'dirty', 'created_at', 'updated_at']))
    })
    test('invites columns', () => {
      expect(VALID_COLUMNS.invites).toEqual(new Set(['id', 'dictionary_id', 'inviter_user_id', 'inviter_email', 'target_email', 'role', 'status', 'dirty', 'created_at', 'updated_at']))
    })
  })
}
