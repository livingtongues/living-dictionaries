import type { SqliteConnection } from '../connection'
import type { TableName } from './types'
import { stringify_row } from '$lib/db/schemas/json-columns'

/**
 * Core of the reactive row `_save()`: persist a mutated LiveDb row by writing
 * ONLY the columns whose in-memory value differs from what's already in the DB
 * (i.e. exactly your mutations), leaving every other column as the DB has it.
 *
 * For syncable tables it also sets `dirty = 1` and bumps `updated_at` (mirroring
 * those onto the passed row), so a plain `mutate → _save()` actually uploads —
 * the same auto-stamping `update()`/`insert()` already do. This is the contract
 * the database SKILL documents; the old `_save` rewrote every column and never
 * flagged dirty, so edits silently never synced.
 *
 * Extracted from `live-db.svelte.ts` so it's unit-testable against a real
 * in-memory SQLite connection without the Svelte reactive machinery.
 *
 * Diff detail: compare `stringify_row({...row})[col]` against the RAW persisted
 * value — the persisted JSON columns are already stored strings, so we must NOT
 * stringify them again. Round-trips are canonical, so an unmutated JSON column
 * won't false-positive.
 *
 * INTENTIONAL CROSS-REPO DIFFERENCE: this admin/catalog core (shared in spirit
 * with tutor/house) treats a no-op save as a no-op — no changed columns →
 * `wrote: false`, so a spurious `_save()` never churns `dirty`/`updated_at`.
 * The per-dict sibling `dict-client/dict-save-row.ts` deliberately does the
 * opposite (ALWAYS re-dirties + re-attributes) because dict-content edits carry
 * editor provenance that must flow through the history pipeline. Keep the two
 * distinct — see that file's header for the rationale.
 */
export async function save_changed_columns(options: {
  connection: SqliteConnection
  table_name: TableName
  row: Record<string, unknown>
  primary_keys: readonly string[]
  is_syncable: boolean
}): Promise<{ changed_columns: string[], wrote: boolean }> {
  const { connection, table_name, row, primary_keys, is_syncable } = options

  for (const key of primary_keys) {
    if (row[key] === undefined || row[key] === null) {
      console.warn(`LiveDb save: row missing primary key "${key}"`)
      return { changed_columns: [], wrote: false }
    }
  }

  const where_sql = primary_keys.map(key => `"${key}" = ?`).join(' AND ')
  const where_params = primary_keys.map(key => row[key])

  const [persisted] = await connection.query<Record<string, unknown>>(
    `SELECT * FROM "${table_name}" WHERE ${where_sql}`,
    where_params,
  )

  const exclude = new Set<string>(['created_at', 'updated_at', 'dirty', '_save', '_delete', '_reset', ...primary_keys])
  const row_to_write = stringify_row(table_name, { ...row })
  const candidate_columns = Object.keys(row).filter(column => !exclude.has(column))

  // No persisted row → the UPDATE below would no-op anyway; fall back to writing
  // every candidate column (matches the old `_save`, which was also a bare UPDATE).
  const changed_columns = persisted
    ? candidate_columns.filter(column => row_to_write[column] !== persisted[column])
    : candidate_columns

  if (changed_columns.length === 0)
    return { changed_columns: [], wrote: false }

  const set_columns = [...changed_columns]
  const params: unknown[] = changed_columns.map(column => row_to_write[column])

  if (is_syncable) {
    set_columns.push('dirty')
    params.push(1)
    row.dirty = 1
    const now = new Date().toISOString()
    set_columns.push('updated_at')
    params.push(now)
    row.updated_at = now
  }

  const set_clause = set_columns.map(column => `"${column}" = ?`).join(', ')
  await connection.execute(
    `UPDATE "${table_name}" SET ${set_clause} WHERE ${where_sql}`,
    [...params, ...where_params],
  )

  return { changed_columns, wrote: true }
}
