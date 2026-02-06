import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm'
import type * as schema from '../schema'

// Change operation types from PGLite
export type ChangeOp = 'INSERT' | 'UPDATE' | 'DELETE' | 'RESET'

export type ChangeInsert<T> = {
  __op__: 'INSERT'
  __changed_columns__: string[]
  __after__: string
} & T

export type ChangeUpdate<T> = {
  __op__: 'UPDATE'
  __changed_columns__: string[]
  __after__: string
} & T

export type ChangeDelete<T> = {
  __op__: 'DELETE'
  __changed_columns__: string[]
  __after__: undefined
} & T

export type ChangeReset<T> = {
  __op__: 'RESET'
} & T

export type Change<T> =
  | ChangeInsert<T>
  | ChangeUpdate<T>
  | ChangeDelete<T>
  | ChangeReset<T>

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

// Get the raw row type without the save method (for internal use)
export type RawRowType<T extends TableName> = Schema[T] extends Table
  ? InferSelectModel<Schema[T]>
  : never

// Get the insert type for a given table name
export type InsertType<T extends TableName> = Schema[T] extends Table
  ? InferInsertModel<Schema[T]>
  : never

// What you get when accessing db.table_name
export interface TableAccessor<T extends TableName> {
  readonly loading: boolean
  readonly rows: RowType<T>[]
  readonly objects: Record<string, RowType<T>>
  id: (row_id: string) => RowType<T> | undefined
  query: (options: QueryOptions) => QueryAccessor<T>

  // Table-level operations (row-level operations are on the row object via Saveable)
  insert: (item: InsertType<T> | InsertType<T>[]) => Promise<RowType<T>[]>
  delete_all: (ids: string[]) => Promise<void>
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
}
