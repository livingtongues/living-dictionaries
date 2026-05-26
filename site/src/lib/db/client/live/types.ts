import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm'
import type * as schema from '../../schemas/shared'

// Schema type inference
export type Schema = typeof schema

// Extract table names from schema (only keys that are Tables)
export type TableName = {
  [K in keyof Schema]: Schema[K] extends Table ? K : never
}[keyof Schema]

// Saveable interface - allows direct mutation and saving
export interface Saveable {
  _save: () => Promise<void>
  _delete: () => Promise<void>
  _reset: () => Promise<void>
}

// Get the row type for a given table name (with _save, _delete, _reset methods)
export type RowType<T extends TableName> = Schema[T] extends Table
  ? InferSelectModel<Schema[T]> & Saveable
  : never

// Row shape without Saveable helpers (used for out-of-band reads like `snapshot()`)
export type PlainRowType<T extends TableName> = Schema[T] extends Table
  ? InferSelectModel<Schema[T]>
  : never

// Get the insert type for a given table name
export type InsertType<T extends TableName> = Schema[T] extends Table
  ? InferInsertModel<Schema[T]>
  : never

/**
 * Composite-key tables need their compound key as an object, single-key tables
 * use a plain string id. LD currently has one composite-key table:
 *   - `deletes` (table_name, id) — sync tombstones
 * Single-key non-`id` tables (`db_metadata.key`, `email_aliases.email`,
 * `email_codes`) still use a plain string in `RowKey` — the row_where helper
 * resolves which column name to use from `TABLE_PRIMARY_KEYS`.
 */
export type RowKey<T extends TableName> = T extends 'deletes'
  ? { table_name: string, id: string }
  : string

// For updates: all fields optional except the primary key(s) which are required
export type UpdateType<T extends TableName> = Schema[T] extends Table
  ? T extends 'deletes'
    ? Partial<InferInsertModel<Schema[T]>> & { table_name: string, id: string }
    : T extends 'db_metadata'
      ? Partial<InferInsertModel<Schema[T]>> & { key: string }
      : T extends 'email_codes'
        ? Partial<InferInsertModel<Schema[T]>>
        : T extends 'email_aliases'
          ? Partial<InferInsertModel<Schema[T]>> & { email: string }
          : Partial<InferInsertModel<Schema[T]>> & { id: string }
  : never

// What you get when accessing db.table_name
export interface TableAccessor<T extends TableName> {
  readonly loading: boolean
  readonly rows: RowType<T>[]
  readonly objects: Record<string, RowType<T>>
  id: (key: RowKey<T>) => RowType<T> | undefined
  find: (key: RowKey<T>) => Promise<RowType<T> | undefined>
  query: (options: QueryOptions) => QueryAccessor<T>

  insert: (item: InsertType<T> | InsertType<T>[]) => Promise<RowType<T>[]>
  upsert: (set: InsertType<T> | InsertType<T>[]) => Promise<void>
  /**
   * Last-write-wins merge: inserts new rows, updates only rows whose incoming
   * `updated_at` is newer than what's in the DB, leaves unchanged / older
   * rows untouched. Requires `updated_at` on every input row.
   */
  merge: (set: InsertType<T> | InsertType<T>[]) => Promise<void>
  update: (set: UpdateType<T>) => Promise<void>
  delete: (keys: RowKey<T> | RowKey<T>[]) => Promise<void>
}

// What you get when accessing db.table_name.id
export type IdAccessor<T extends TableName> = Readonly<Record<string, RowType<T> | undefined>>

// Query options for db.table_name.query({...})
export interface QueryOptions {
  where?: string
  params?: unknown[]
  order_by?: string
  limit?: number
  offset?: number
}

// What you get from db.table_name.query({...})
export interface QueryAccessor<T extends TableName> {
  readonly rows: RowType<T>[]
  readonly loading: boolean
  snapshot: () => Promise<PlainRowType<T>[]>
}
