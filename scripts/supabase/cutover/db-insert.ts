import type Database from 'better-sqlite3'

/**
 * Bulk-insert mapper output into a SQLite table inside a single transaction.
 * JSON columns (objects/arrays) are stringified; booleans → 0/1; undefined → null.
 * Returns the number of rows inserted.
 */
export function insert_rows({ db, table, rows, json_cols = [] }: {
  db: Database.Database
  table: string
  rows: Record<string, any>[]
  json_cols?: string[]
}): number {
  if (rows.length === 0)
    return 0

  const columns = Object.keys(rows[0])
  const json_set = new Set(json_cols)
  const placeholders = columns.map(column => `@${column}`).join(', ')
  const column_list = columns.map(column => `"${column}"`).join(', ')
  const stmt = db.prepare(`INSERT INTO ${table} (${column_list}) VALUES (${placeholders})`)

  const insert_many = db.transaction((items: Record<string, any>[]) => {
    for (const item of items) {
      const bound: Record<string, any> = {}
      for (const column of columns) {
        let value = item[column]
        if (value === undefined)
          value = null
        else if (json_set.has(column) && value !== null)
          value = JSON.stringify(value)
        else if (typeof value === 'boolean')
          value = value ? 1 : 0
        bound[column] = value
      }
      stmt.run(bound)
    }
  })

  insert_many(rows)
  return rows.length
}

/**
 * Insert or update by primary-key `id`. Used for shared.db tables that are
 * merged (not rebuilt) so re-runs catch deltas without duplicating rows.
 */
export function upsert_rows({ db, table, rows, json_cols = [] }: {
  db: Database.Database
  table: string
  rows: Record<string, any>[]
  json_cols?: string[]
}): number {
  if (rows.length === 0)
    return 0

  const columns = Object.keys(rows[0])
  const json_set = new Set(json_cols)
  const placeholders = columns.map(column => `@${column}`).join(', ')
  const column_list = columns.map(column => `"${column}"`).join(', ')
  const updates = columns.filter(column => column !== 'id').map(column => `"${column}" = excluded."${column}"`).join(', ')
  const stmt = db.prepare(`INSERT INTO ${table} (${column_list}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`)

  const run_many = db.transaction((items: Record<string, any>[]) => {
    for (const item of items) {
      const bound: Record<string, any> = {}
      for (const column of columns) {
        let value = item[column]
        if (value === undefined)
          value = null
        else if (json_set.has(column) && value !== null)
          value = JSON.stringify(value)
        else if (typeof value === 'boolean')
          value = value ? 1 : 0
        bound[column] = value
      }
      stmt.run(bound)
    }
  })

  run_many(rows)
  return rows.length
}

/**
 * Delete rows whose FK parent is absent (their parent was soft-deleted in
 * Supabase and therefore not migrated). Iterates because pruning can cascade
 * (e.g. a sense under a deleted entry, then that sense's junction rows).
 * Works with `foreign_keys` ON or OFF (`foreign_key_check` is an explicit
 * scan). Returns per-table pruned counts.
 */
export function prune_orphans(db: Database.Database): Record<string, number> {
  const pruned: Record<string, number> = {}
  for (let pass = 0; pass < 10; pass++) {
    const violations = db.pragma('foreign_key_check') as { table: string, rowid: number | bigint }[]
    if (violations.length === 0)
      break
    const by_table = new Map<string, (number | bigint)[]>()
    for (const violation of violations) {
      if (!by_table.has(violation.table))
        by_table.set(violation.table, [])
      by_table.get(violation.table)!.push(violation.rowid)
    }
    for (const [table, rowids] of by_table) {
      const stmt = db.prepare(`DELETE FROM ${table} WHERE rowid = ?`)
      for (const rowid of rowids)
        stmt.run(rowid)
      pruned[table] = (pruned[table] ?? 0) + rowids.length
    }
  }
  return pruned
}

/**
 * Set `db_metadata.last_modified_at` to the max `updated_at` across all content
 * tables — a stable sync cursor (vs. the trigger's "now", which would churn on
 * every rebuild). No-op if the db has no content.
 */
export function set_last_modified_to_max({ db, tables }: { db: Database.Database, tables: string[] }) {
  const selects = tables.map(table => `SELECT MAX(updated_at) AS m FROM ${table}`).join(' UNION ALL ')
  const row = db.prepare(`SELECT MAX(m) AS max_updated FROM (${selects})`).get() as { max_updated: string | null }
  if (row?.max_updated)
    db.prepare(`INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', ?)`).run(row.max_updated)
}
