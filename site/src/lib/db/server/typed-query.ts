import type Database from 'better-sqlite3'
import { parse_row } from '$lib/db/schemas/json-columns'

export type TableName = string

/**
 * Run a SELECT and parse JSON columns on every returned row in place.
 * Thin alternative to wrapping the DB — callers opt in per-query by naming
 * the table. Pair with raw `db.prepare(...).run(...)` for writes.
 */
export function query_all<T>({ db, table, sql, params }: {
  db: Database.Database
  table: TableName
  sql: string
  params?: unknown[]
}): T[] {
  const stmt = db.prepare(sql)
  const rows = (params?.length ? stmt.all(...params) : stmt.all()) as Record<string, unknown>[]
  for (const row of rows)
    parse_row(table, row)
  return rows as T[]
}

export function query_one<T>({ db, table, sql, params }: {
  db: Database.Database
  table: TableName
  sql: string
  params?: unknown[]
}): T | undefined {
  const stmt = db.prepare(sql)
  const row = (params?.length ? stmt.get(...params) : stmt.get()) as Record<string, unknown> | undefined
  if (!row)
    return undefined
  parse_row(table, row)
  return row as T
}
