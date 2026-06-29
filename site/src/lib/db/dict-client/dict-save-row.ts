import type { DictConnection } from './worker-connection'
import { stringify_dict_row } from '$lib/db/schemas/dictionary-json-columns'

/**
 * Core of the dict.db reactive row `_save()`. Mirrors `client/live/save-row.ts`
 * but for the per-dictionary DB, with two dict-specific differences:
 *
 *  - It ALWAYS re-stamps `dirty = 1` + `updated_at` (+ `updated_by_user_id` to
 *    the current editor for syncable tables), even when no content column
 *    changed — so a `_save()` reliably flips a previously-cleaned row back to
 *    dirty (and re-attributes the edit). Hence `wrote` is always true.
 *  - All dict tables are single `id`-keyed (no composite keys).
 *
 * Like the admin core it writes ONLY the content columns whose in-memory value
 * differs from the DB (diffed via `stringify_dict_row` so JSON columns compare
 * by content), so a save never clobbers a column another writer/sync just
 * changed. Extracted so it's unit-testable without the Svelte reactive layer.
 */
export async function save_changed_dict_columns(options: {
  connection: Pick<DictConnection, 'query' | 'execute'>
  table: string
  row: Record<string, unknown>
  is_syncable: boolean
  user_id: string | undefined
}): Promise<{ changed_columns: string[], wrote: boolean }> {
  const { connection, table, row, is_syncable, user_id } = options
  if (!row.id)
    return { changed_columns: [], wrote: false }

  // PK + creation provenance are immutable post-insert; dirty/updated_at/
  // updated_by_user_id are re-stamped explicitly below.
  const exclude = new Set([
    'id', 'created_at', 'created_by_user_id', 'dirty', 'updated_at', 'updated_by_user_id',
    '_save', '_delete', '_reset',
  ])
  const stringified = stringify_dict_row(table, { ...row })
  const [persisted] = await connection.query<Record<string, unknown>>(`SELECT * FROM "${table}" WHERE id = ?`, [row.id])
  const changed_columns = Object.keys(row).filter(column => !exclude.has(column) && (!persisted || stringified[column] !== persisted[column]))

  const clauses: string[] = []
  const params: unknown[] = []
  for (const column of changed_columns) {
    clauses.push(`"${column}" = ?`)
    params.push(stringified[column])
  }
  clauses.push('"dirty" = 1')
  clauses.push('"updated_at" = ?')
  params.push(new Date().toISOString())
  if (is_syncable && user_id) {
    clauses.push('"updated_by_user_id" = ?')
    params.push(user_id)
  }
  params.push(row.id)

  await connection.execute(`UPDATE "${table}" SET ${clauses.join(', ')} WHERE id = ?`, params)
  return { changed_columns, wrote: true }
}
