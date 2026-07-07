import type Database from 'better-sqlite3'
import type { Table } from 'drizzle-orm'
import type { HistoryEvent } from './dictionary-history-db'
import type { DictSyncableTable } from '$lib/db/dict-syncable-tables'
import { parse_dict_row, stringify_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import * as dict_schema from '$lib/db/schemas/dictionary'
import { getTableColumns } from 'drizzle-orm'
import { DICT_SYNCABLE_TABLES } from '$lib/db/dict-syncable-tables'
import { build_delta, build_snapshot, resolve_owners } from './dictionary-history-capture'
import { record_history } from './dictionary-history-db'

// The table list + its type now live in a client-safe module (no better-sqlite3)
// so the browser dict-client can import the VALUE without dragging native server
// code into its bundle. Re-exported here for back-compat with server importers.
export type { DictSyncableTable }
export { DICT_SYNCABLE_TABLES }

const VALID_COLUMNS: Record<DictSyncableTable, Set<string>> = Object.fromEntries(
  DICT_SYNCABLE_TABLES.map(name => [
    name,
    new Set(Object.keys(getTableColumns(dict_schema[name] as Table))),
  ]),
) as Record<DictSyncableTable, Set<string>>

/**
 * The UNIQUE natural-key columns each syncable dict table carries IN ADDITION to
 * its synthetic-UUID `id` primary key (see `dictionary-migrations/*.sql`). Two
 * clients that create the SAME natural row — a junction linking the same
 * (entry, tag), a source with the same slug — mint DIFFERENT random-UUID ids
 * (`insert_row` in `dict-writes.ts`), so the second push's INSERT collides on the
 * natural-key UNIQUE, which `merge_dict_row`'s `ON CONFLICT(id)` upsert does NOT
 * catch → `UNIQUE constraint failed` → the whole per-dict push 500s and rolls
 * back. This is the per-dict sibling of house's `people.name` collision
 * (`.issues/sync-junction-natural-key-collision.md`). Every
 * listed table is a LEAF row (no other row FK-references its id), so deduping the
 * pushed row onto the canonical existing id needs no FK-remap / id echo — unlike
 * house's lookup dedupe. NULLable columns are matched with COALESCE(…,'') to
 * mirror the functional UNIQUE index on `entry_relationships`.
 */
const DICT_NATURAL_KEY_COLUMNS: Partial<Record<DictSyncableTable, readonly string[]>> = {
  senses_in_sentences: ['sense_id', 'sentence_id'],
  audio_speakers: ['audio_id', 'speaker_id'],
  video_speakers: ['video_id', 'speaker_id'],
  sense_videos: ['sense_id', 'video_id'],
  sentence_videos: ['sentence_id', 'video_id'],
  sense_photos: ['sense_id', 'photo_id'],
  sentence_photos: ['sentence_id', 'photo_id'],
  entry_dialects: ['entry_id', 'dialect_id'],
  entry_tags: ['entry_id', 'tag_id'],
  featured_entries: ['entry_id'],
  sources: ['slug'],
  entry_relationships: ['from_entry_id', 'from_sense_id', 'to_entry_id', 'to_sense_id', 'type', 'custom_type_id'],
}

/**
 * The id currently owning `row`'s natural key on the server, or undefined when
 * the table has no natural key or no row owns it. COALESCE(…,'') on both sides
 * so NULL columns compare equal (matching the `entry_relationships` functional
 * index and treating absent/NULL uniformly).
 */
function find_natural_key_owner_id({ db, table_name, row }: {
  db: Database.Database
  table_name: DictSyncableTable
  row: Record<string, unknown>
}): string | undefined {
  const columns = DICT_NATURAL_KEY_COLUMNS[table_name]
  if (!columns)
    return undefined
  const where = columns.map(column => `COALESCE("${column}",'') = COALESCE(?,'')`).join(' AND ')
  const params = columns.map(column => (row[column] ?? null) as string | null)
  const owner = db.prepare(`SELECT id FROM "${table_name}" WHERE ${where} LIMIT 1`).get(...params) as { id: string } | undefined
  return owner?.id
}

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
  /**
   * Pushed dirty rows that were skipped because they violate a foreign key —
   * an orphaned child whose server-side parent no longer exists (its parent was
   * deleted by another editor). Present only on the rare FK-recovery path so
   * one dangling row can't 500 (and poison) a client's entire sync. The client
   * converges when the parent's tombstone arrives via pull.
   */
  skipped_orphans?: SkippedOrphan[]
}

export interface SkippedOrphan {
  table_name: string
  id: string
  /** The referenced parent table whose row is missing. */
  parent_table: string
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
 * WATERMARK VOCABULARY — this file's `synced_up_to` / `new_synced_up_to` is the
 * **dict_content_cursor**: a browser client's high-water mark over ONE
 * `dictionaries/{id}.db`'s content, tracked via that dict.db's
 * `db_metadata.last_modified_at`. It is NOT the `admin_catalog_cursor` of
 * `sync-helpers.ts` (which watermarks `shared.db`), and it is the value the
 * caller then mirrors onto `shared.db.dictionaries.updated_at` as the
 * `catalog_updated_at_mirror` (see `v1-route-context.ts` / the bullet below).
 *
 * The caller (endpoint handler) is responsible for:
 *   - migration version handshake (`schema_outdated` / `server_outdated`)
 *   - snapshot_expired check (cursor > 60 days behind)
 *   - role lookup (verify the user can write)
 *   - mirroring `last_modified_at` to `shared.db.dictionaries.updated_at`
 *     (the `catalog_updated_at_mirror`)
 *
 * This function is push+pull in one atomic round-trip.
 *
 * Wraps `apply_dict_changes` with a foreign-key recovery path: because the batch
 * runs under `defer_foreign_keys=ON`, a single orphaned child row (its parent
 * was deleted by another editor) trips the constraint at COMMIT and rolls back
 * the WHOLE push — which would otherwise 500 (and poison) every subsequent sync
 * from that client until they refetch. Instead we identify the orphaned pushed
 * rows, skip them, retry, and report them in `skipped_orphans`. Observed once
 * 2026-07-04 on `rhenic`.
 */
export function process_dict_changes(params: {
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
  try {
    return apply_dict_changes(params)
  } catch (error) {
    if (!params.is_editor || !is_foreign_key_error(error))
      throw error
    // Recovery is best-effort: if probing/retrying itself throws, surface the
    // ORIGINAL FK error so we never mask the real fault or change behaviour.
    try {
      const orphans = identify_orphan_push_rows(params)
      if (!orphans.length)
        throw error // FK violation not attributable to a pushed row — surface it.
      const skip_keys = new Set(orphans.map(orphan => `${orphan.table_name}::${orphan.id}`))
      const response = apply_dict_changes({ ...params, skip_keys })
      response.skipped_orphans = orphans
      return response
    } catch {
      throw error
    }
  }
}

/** better-sqlite3 throws `SqliteError` with this code on a FK-constraint failure. */
function is_foreign_key_error(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY')
    return true
  const message = (error as { message?: unknown } | null | undefined)?.message
  return typeof message === 'string' && /FOREIGN KEY constraint failed/i.test(message)
}

/**
 * Re-apply the push in a throwaway transaction, ask SQLite which rows dangle
 * (`PRAGMA foreign_key_check`), and return the orphans that came from THIS
 * push's dirty rows. Never commits — pure diagnosis. Only runs on the rare
 * FK-recovery path, so the happy path pays nothing.
 */
function identify_orphan_push_rows({ db, request, user_id }: {
  db: Database.Database
  request: DictChangesRequest
  user_id: string
}): SkippedOrphan[] {
  const pushed = new Set<string>()
  if (request.dirty_rows) {
    for (const table_name of DICT_SYNCABLE_TABLES) {
      for (const row of request.dirty_rows[table_name] ?? [])
        pushed.add(`${table_name}::${(row as { id: string }).id}`)
    }
  }
  if (!pushed.size)
    return []

  db.pragma('defer_foreign_keys = ON')
  db.exec('BEGIN IMMEDIATE')
  try {
    if (request.deletes?.length) {
      for (const { table_name, id } of request.deletes) {
        if (!is_dict_syncable_table(table_name))
          continue
        db.prepare(
          `INSERT OR REPLACE INTO deletes (table_name, id, updated_at)
           VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        ).run(table_name, id)
      }
    }
    for (const table_name of DICT_SYNCABLE_TABLES) {
      for (const row of request.dirty_rows?.[table_name] ?? [])
        merge_dict_row({ db, table_name, row, user_id })
    }
    const violations = db.pragma('foreign_key_check') as { table: string, rowid: number, parent: string, fkid: number }[]
    const orphans: SkippedOrphan[] = []
    const seen = new Set<string>()
    for (const violation of violations) {
      const found = db.prepare(`SELECT id FROM "${violation.table}" WHERE rowid = ?`).get(violation.rowid) as { id?: string } | undefined
      const id = found?.id
      if (!id)
        continue
      const key = `${violation.table}::${id}`
      if (!pushed.has(key) || seen.has(key))
        continue
      seen.add(key)
      orphans.push({ table_name: violation.table, id, parent_table: violation.parent })
    }
    return orphans
  } finally {
    db.exec('ROLLBACK') // Diagnosis only — never keep these writes.
  }
}

function apply_dict_changes({ db, request, user_id, is_editor, history_db, skip_keys }: {
  db: Database.Database
  request: DictChangesRequest
  user_id: string
  is_editor: boolean
  history_db?: Database.Database
  /** Pushed `${table}::${id}` keys to skip merging (FK-orphan recovery). */
  skip_keys?: ReadonlySet<string>
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
          if (skip_keys?.has(`${table_name}::${(row as { id: string }).id}`))
            continue // FK-orphan: skip so it can't poison the whole batch.
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
        for (const row of request.dirty_rows[table_name] ?? []) {
          const key = `${table_name}::${(row as { id: string }).id}`
          if (skip_keys?.has(key))
            continue // Not written server-side, so don't filter it from the pull.
          uploaded_keys.add(key)
        }
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

/**
 * Upsert one row into a syncable dict table with LWW + audit stamping, the same
 * way a pushed editor row lands. Exported so the `/api/v1` write API applies
 * rows through the EXACT path a browser push uses (history-aware via `at`).
 */
export function merge_dict_row({ db, table_name, row, user_id, at, api_key_id }: {
  db: Database.Database
  table_name: DictSyncableTable
  row: Record<string, unknown>
  user_id: string
  /** Batch history timestamp; when set, returns a HistoryEvent to record. */
  at?: string
  /** Acting agent's API key id (v1 API key path); null/omitted for human edits. */
  api_key_id?: string | null
}): HistoryEvent | null {
  const row_id = row.id as string
  if (!row_id)
    return null

  // Full existing row: needed for the LWW check AND the history delta.
  let existing = db.prepare(
    `SELECT * FROM "${table_name}" WHERE id = ?`,
  ).get(row_id) as Record<string, unknown> | undefined

  // Natural-key collision guard. When the pushed id is unknown here but its
  // natural key already belongs to a DIFFERENT id, two clients minted the same
  // junction/lookup row with different random UUIDs — dedupe onto that canonical
  // id (LWW-merge the pushed content onto it) instead of letting the INSERT throw
  // `UNIQUE constraint failed` and roll back the whole push. See
  // DICT_NATURAL_KEY_COLUMNS. Leaf rows → no FK-remap / echo needed.
  let canonical_id = row_id
  if (!existing) {
    const owner_id = find_natural_key_owner_id({ db, table_name, row })
    if (owner_id && owner_id !== row_id) {
      canonical_id = owner_id
      existing = db.prepare(
        `SELECT * FROM "${table_name}" WHERE id = ?`,
      ).get(owner_id) as Record<string, unknown> | undefined
    }
  }

  if (existing && (row.updated_at as string) && (existing.updated_at as string) > (row.updated_at as string)) {
    // Server wins — caller will see this row come back in the pull stage.
    // Nothing changed, so no history.
    return null
  }

  const op: 'insert' | 'update' = existing ? 'update' : 'insert'
  // When deduped onto a canonical id, upsert against THAT id so the content
  // merges onto the existing row rather than inserting a duplicate natural key.
  const merge_source = canonical_id === row_id ? row : { ...row, id: canonical_id }
  const delta = at ? build_delta(table_name, existing, merge_source) : null

  // Stamp updated_by_user_id with the authenticated caller (server is the
  // authority on this). created_by_user_id is preserved if the row already
  // exists; otherwise it's stamped with the caller too.
  const stringified = stringify_dict_row(table_name, { ...merge_source })
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
  const after = db.prepare(`SELECT * FROM "${table_name}" WHERE id = ?`).get(canonical_id) as Record<string, unknown>
  return {
    table_name,
    row_id: canonical_id,
    op,
    user_id,
    at,
    snapshot: build_snapshot(table_name, after),
    delta,
    api_key_id: api_key_id ?? null,
    owners: resolve_owners(db, table_name, after),
  }
}

/**
 * Hard-delete ONE row via a `deletes` tombstone — the write-side mirror of
 * `merge_dict_row`. Inserting the tombstone fires `process_delete_cascade`
 * (DELETEs the row; FK `ON DELETE CASCADE` sweeps its children/junctions) and
 * bumps `last_modified_at`, exactly like an editor delete, so peers converge via
 * `/changes`. Returns a `delete` HistoryEvent to record (when `at` is given), or
 * `{ deleted: false }` when the row was already gone. Capture the before-image +
 * owners BEFORE the tombstone (the row is gone right after).
 */
export function delete_dict_row({ db, table_name, id, user_id, at, api_key_id }: {
  db: Database.Database
  table_name: DictSyncableTable
  id: string
  user_id: string
  /** History timestamp; when set, returns a HistoryEvent to record. */
  at?: string
  /** Acting agent's API key id (v1 API key path); null/omitted for human edits. */
  api_key_id?: string | null
}): { deleted: boolean, event: HistoryEvent | null } {
  const image = db.prepare(`SELECT * FROM "${table_name}" WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!image)
    return { deleted: false, event: null }
  const owners = resolve_owners(db, table_name, image)
  db.prepare(
    `INSERT OR REPLACE INTO deletes (table_name, id, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
  ).run(table_name, id)
  const event: HistoryEvent | null = at
    ? { table_name, row_id: id, op: 'delete', user_id, at, snapshot: build_snapshot(table_name, image), delta: null, api_key_id: api_key_id ?? null, owners }
    : null
  return { deleted: true, event }
}

/** Strip the `.sql` extension for tolerant comparison of migration names. */
export function strip_sql_ext(name: string): string {
  return name.replace(/\.sql$/, '')
}
