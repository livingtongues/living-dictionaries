import type { SyncableTableName } from '$lib/db/sync/types'
import type { SqliteConnection } from '../connection'
import type {
  InsertType,
  PlainRowType,
  QueryAccessor,
  QueryOptions,
  RowKey,
  RowType,
  TableAccessor,
  TableName,
  UpdateType,
} from './types'
import { parse_row, stringify_row } from '$lib/db/schemas/json-columns'
import { is_syncable_table } from '$lib/db/sync/types'
import { TableChangeNotifier } from './notifier'
import { TableStore } from './table-store.svelte.js'

/**
 * Tables whose primary key is not `id`. When adding a new composite-key
 * table here, update `RowKey<T>` / `UpdateType<T>` in `./types.ts` too.
 */
const TABLE_PRIMARY_KEYS: Partial<Record<TableName, readonly string[]>> = {
  deletes: ['table_name', 'id'],
  db_metadata: ['key'],
  email_aliases: ['email'],
}

function primary_keys_for(table: TableName): readonly string[] {
  return TABLE_PRIMARY_KEYS[table] ?? ['id']
}

function row_where(table: TableName, row_or_key: Record<string, unknown> | string): { sql: string, params: unknown[] } {
  const keys = primary_keys_for(table)
  if (typeof row_or_key === 'string') {
    if (keys.length !== 1)
      throw new Error(`Table "${table}" has a composite primary key — pass an object, not a string`)
    return { sql: `"${keys[0]}" = ?`, params: [row_or_key] }
  }
  if (row_or_key === undefined || row_or_key === null)
    throw new Error(`row_where("${table}") called with ${row_or_key === null ? 'null' : 'undefined'} key`)
  const sql = keys.map(k => `"${k}" = ?`).join(' AND ')
  const params = keys.map(k => row_or_key[k])
  return { sql, params }
}

function make_row_key(keys: readonly string[], row: Record<string, unknown>): string {
  return keys.map(k => String(row[k])).join('::')
}

export interface LiveDbOptions {
  log?: boolean
  /**
   * Fires after any write to a syncable table so the sync engine can flag
   * a sync flush. Only called for tables in `SYNCABLE_TABLES`.
   */
  on_dirty?: (table_name: SyncableTableName) => void
}

type TableProperties = {
  [K in TableName]: TableAccessor<K>
}

class LiveDbImpl {
  #connection: SqliteConnection
  #notifier = new TableChangeNotifier()
  #options: LiveDbOptions

  #table_stores = new Map<string, TableStore<Record<string, unknown>>>()
  #row_stores = new Map<string, TableStore<Record<string, unknown>>>()
  #query_stores = new Map<string, TableStore<Record<string, unknown>>>()
  #table_has_id_column = new Map<string, boolean>()
  #savepoint_counter = 0

  constructor(connection: SqliteConnection, options: LiveDbOptions = {}) {
    this.#connection = connection
    this.#options = options
  }

  set_on_dirty(callback: (table_name: SyncableTableName) => void) {
    this.#options.on_dirty = callback
  }

  #fire_dirty(table_name: TableName) {
    if (is_syncable_table(table_name))
      this.#options.on_dirty?.(table_name)
  }

  notify_table(table_name: TableName): void {
    this.#notifier.notify(table_name)
  }

  subscribe = (table_name: TableName, callback: () => void): (() => void) => {
    return this.#notifier.subscribe(table_name, callback)
  }

  get_table_accessor<T extends TableName>(table_name: T): TableAccessor<T> {
    return this.#get_table_accessor(table_name)
  }

  #get_table_accessor<T extends TableName>(table_name: T): TableAccessor<T> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    return {
      get loading(): boolean {
        return self.#get_or_create_table_store(table_name).loading
      },

      get rows(): RowType<T>[] {
        return self.#get_or_create_table_store(table_name).rows as RowType<T>[]
      },

      get objects(): Record<string, RowType<T>> {
        return self.#get_or_create_table_store(table_name).objects as Record<string, RowType<T>>
      },

      id(key: RowKey<T>): RowType<T> | undefined {
        if (key === undefined || key === null)
          return undefined
        // svelte-ignore state_referenced_locally
        const rows = $derived(self.#get_row_by_key(table_name, key).rows)
        return rows[0] as RowType<T> | undefined
      },

      async find(key: RowKey<T>): Promise<RowType<T> | undefined> {
        if (key === undefined || key === null)
          return undefined
        const where = row_where(table_name, key as Record<string, unknown> | string)
        const rows = await self.#connection.query<Record<string, unknown>>(
          `SELECT * FROM "${table_name}" WHERE ${where.sql} LIMIT 1`,
          where.params,
        )
        if (rows[0]) {
          parse_row(table_name, rows[0])
        }
        return rows[0] as RowType<T> | undefined
      },

      query(options: QueryOptions): QueryAccessor<T> {
        return self.#create_query_accessor(table_name, options)
      },

      insert(item: InsertType<T> | InsertType<T>[]): Promise<RowType<T>[]> {
        return self.#insert(table_name, item)
      },

      upsert(set: InsertType<T> | InsertType<T>[]): Promise<void> {
        return self.#upsert(table_name, set)
      },

      merge(set: InsertType<T> | InsertType<T>[]): Promise<void> {
        return self.#merge(table_name, set)
      },

      update(set: UpdateType<T>): Promise<void> {
        return self.#update(table_name, set)
      },

      delete(keys: RowKey<T> | RowKey<T>[]): Promise<void> {
        const list = Array.isArray(keys) ? keys : [keys]
        return self.#delete(table_name, list as (string | Record<string, unknown>)[])
      },
    }
  }

  #get_or_create_table_store<T extends TableName>(table_name: T): TableStore<Record<string, unknown>> {
    let store = this.#table_stores.get(table_name)
    if (!store) {
      store = new TableStore({
        connection: this.#connection,
        notifier: this.#notifier,
        table_name,
        query: `SELECT * FROM "${table_name}"`,
        params: [],
        primary_keys: [...primary_keys_for(table_name)],
        log: this.#options.log,
        on_save: this.#create_save_callback(table_name),
        on_delete: this.#create_delete_callback(table_name),
        on_reset: this.#create_reset_callback(table_name),
      })
      this.#table_stores.set(table_name, store)
    }
    return store
  }

  #create_save_callback(table_name: TableName): (row: Record<string, unknown>) => Promise<void> {
    return async (row: Record<string, unknown>) => {
      const keys = primary_keys_for(table_name)
      for (const k of keys) {
        if (row[k] === undefined || row[k] === null) {
          console.warn(`LiveDb save: row missing primary key "${k}"`)
          return
        }
      }

      const exclude_columns = new Set<string>(['created_at', '_save', '_delete', '_reset', ...keys])
      const columns = Object.keys(row).filter(col => !exclude_columns.has(col))

      const where = row_where(table_name, row)
      const row_to_write = stringify_row(table_name, { ...row })
      const params: unknown[] = columns.map((col) => {
        if (col === 'updated_at')
          return new Date().toISOString()
        return row_to_write[col]
      })
      params.push(...where.params)

      const set_clauses = columns.map(col => `"${col}" = ?`).join(', ')
      const sql = `UPDATE "${table_name}" SET ${set_clauses} WHERE ${where.sql}`

      try {
        await this.#connection.execute(sql, params)
        this.#notifier.notify(table_name)
        this.#fire_dirty(table_name)
      } catch (error) {
        console.error('LiveDb save error:', error)
        throw error
      }
    }
  }

  #create_delete_callback(table_name: TableName): (id: string) => Promise<void> {
    return async (id: string) => {
      try {
        await this.#connection.execute(
          `INSERT INTO deletes (table_name, id) VALUES (?, ?)`,
          [table_name, id],
        )
        await this.#connection.execute(`DELETE FROM "${table_name}" WHERE id = ?`, [id])
        this.#notifier.notify(table_name)
        this.#notifier.notify('deletes')
        this.#fire_dirty(table_name)
      } catch (error) {
        console.error('LiveDb delete error:', error)
        throw error
      }
    }
  }

  #create_reset_callback(table_name: TableName): (row: Record<string, unknown>) => Promise<void> {
    return async (row: Record<string, unknown>) => {
      const keys = primary_keys_for(table_name)
      for (const k of keys) {
        if (row[k] === undefined || row[k] === null) {
          console.warn(`LiveDb reset: row missing primary key "${k}"`)
          return
        }
      }
      const where = row_where(table_name, row)
      try {
        const [db_row] = await this.#connection.query<Record<string, unknown>>(
          `SELECT * FROM "${table_name}" WHERE ${where.sql}`,
          where.params,
        )
        if (db_row) {
          parse_row(table_name, db_row)
          for (const key of Object.keys(db_row)) {
            row[key] = db_row[key]
          }
        }
      } catch (error) {
        console.error('LiveDb reset error:', error)
        throw error
      }
    }
  }

  #get_row_by_key<T extends TableName>(table_name: T, key: string | Record<string, unknown>): TableStore<Record<string, unknown>> {
    const where = row_where(table_name, key)
    const primary_keys = [...primary_keys_for(table_name)]
    const key_string = typeof key === 'string' ? key : make_row_key(primary_keys, key)
    const store_key = `${table_name}:${key_string}`
    let store = this.#row_stores.get(store_key)

    if (!store) {
      store = new TableStore({
        connection: this.#connection,
        notifier: this.#notifier,
        table_name,
        query: `SELECT * FROM "${table_name}" WHERE ${where.sql}`,
        params: where.params,
        primary_keys,
        log: this.#options.log,
        on_save: this.#create_save_callback(table_name),
        on_delete: this.#create_delete_callback(table_name),
        on_reset: this.#create_reset_callback(table_name),
      })
      this.#row_stores.set(store_key, store)
    }
    return store
  }

  #create_query_accessor<T extends TableName>(table_name: T, options: QueryOptions): QueryAccessor<T> {
    const sql = this.#build_query_sql(table_name, options)
    const params = options.params ?? []
    const query_key = this.#get_query_key(sql, params)

    let store = this.#query_stores.get(query_key)

    if (!store) {
      store = new TableStore({
        connection: this.#connection,
        notifier: this.#notifier,
        table_name,
        query: sql,
        params,
        primary_keys: [...primary_keys_for(table_name)],
        log: this.#options.log,
        on_save: this.#create_save_callback(table_name),
        on_delete: this.#create_delete_callback(table_name),
        on_reset: this.#create_reset_callback(table_name),
      })
      this.#query_stores.set(query_key, store)
    }

    return {
      get rows(): RowType<T>[] {
        return store!.rows as RowType<T>[]
      },
      get loading(): boolean {
        return store!.loading
      },
      snapshot: async (): Promise<PlainRowType<T>[]> => {
        const rows = await this.#connection.query<PlainRowType<T>>(sql, params)
        for (const row of rows) parse_row(table_name, row as Record<string, unknown>)
        return rows
      },
    }
  }

  #build_query_sql(table_name: TableName, options: QueryOptions): string {
    let sql = `SELECT * FROM "${table_name}"`
    if (options.where)
      sql += ` WHERE ${options.where}`
    if (options.order_by)
      sql += ` ORDER BY ${options.order_by}`
    if (options.limit !== undefined)
      sql += ` LIMIT ${options.limit}`
    if (options.offset !== undefined)
      sql += ` OFFSET ${options.offset}`
    return sql
  }

  #get_query_key(sql: string, params: unknown[]): string {
    return JSON.stringify({ sql, params })
  }

  async #check_table_has_id_column(table_name: string): Promise<boolean> {
    const cached = this.#table_has_id_column.get(table_name)
    if (cached !== undefined)
      return cached
    const columns = await this.#connection.query<{ name: string }>(`PRAGMA table_info("${table_name}")`, [])
    const has_id = columns.some(col => col.name === 'id')
    this.#table_has_id_column.set(table_name, has_id)
    return has_id
  }

  async #insert<T extends TableName>(table_name: T, set: InsertType<T> | InsertType<T>[]): Promise<RowType<T>[]> {
    const items = Array.isArray(set) ? set : [set]
    if (items.length === 0)
      return []
    const columns = Object.keys(items[0] as object)

    const BATCH_SIZE = 5000
    const results: RowType<T>[] = []
    const has_id_in_data = columns.includes('id')
    const table_has_id = await this.#check_table_has_id_column(table_name)
    if (!has_id_in_data && table_has_id)
      columns.push('id')
    const is_syncable = is_syncable_table(table_name)
    if (is_syncable) {
      if (!columns.includes('dirty'))
        columns.push('dirty')
      if (!columns.includes('updated_at'))
        columns.push('updated_at')
    }
    const final_columns_sql = columns.map(c => `"${c}"`).join(', ')

    try {
      for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
        const batch = items.slice(offset, offset + BATCH_SIZE)
        const use_savepoint = batch.length > 1
        const savepoint = use_savepoint ? `sp_${++this.#savepoint_counter}` : ''
        if (use_savepoint)
          await this.#connection.execute(`SAVEPOINT ${savepoint}`)
        try {
          for (const row of batch) {
            const row_data = row as Record<string, unknown>
            if (table_has_id && (!has_id_in_data || !row_data.id))
              row_data.id = crypto.randomUUID()
            if (is_syncable) {
              if (row_data.dirty === undefined)
                row_data.dirty = 1
              if (!row_data.updated_at)
                row_data.updated_at = new Date().toISOString()
            }
            const stringified = stringify_row(table_name, { ...row_data })
            const params = columns.map(col => stringified[col])
            const placeholders = columns.map(() => '?').join(', ')
            const sql = `INSERT INTO "${table_name}" (${final_columns_sql}) VALUES (${placeholders})`
            await this.#connection.execute(sql, params)

            if (table_has_id) {
              const id = row_data.id as string
              if (id) {
                const rows = await this.#connection.query<Record<string, unknown>>(`SELECT * FROM "${table_name}" WHERE id = ?`, [id])
                if (rows[0]) {
                  parse_row(table_name, rows[0])
                  results.push(rows[0] as RowType<T>)
                }
              }
            }
          }
          if (use_savepoint)
            await this.#connection.execute(`RELEASE ${savepoint}`)
        } catch (batch_error) {
          if (use_savepoint)
            await this.#connection.execute(`ROLLBACK TO ${savepoint}`)
          throw batch_error
        }
      }

      this.#notifier.notify(table_name)
      this.#fire_dirty(table_name)
    } catch (error) {
      console.error('LiveDb insert error:', error)
      throw error
    }

    return results
  }

  async #upsert<T extends TableName>(table_name: T, set: InsertType<T> | InsertType<T>[]): Promise<void> {
    const items = Array.isArray(set) ? set : [set]
    if (items.length === 0)
      return

    const columns = Object.keys(items[0] as object)
    const is_syncable = is_syncable_table(table_name)
    if (is_syncable) {
      if (!columns.includes('dirty'))
        columns.push('dirty')
      if (!columns.includes('updated_at'))
        columns.push('updated_at')
    }
    const BATCH_SIZE = 5000
    const columns_sql = columns.map(c => `"${c}"`).join(', ')
    const update_sql = columns.map(c => `"${c}" = excluded."${c}"`).join(', ')
    const placeholders = columns.map(() => '?').join(', ')
    const sql = `INSERT INTO "${table_name}" (${columns_sql}) VALUES (${placeholders}) ON CONFLICT DO UPDATE SET ${update_sql}`

    try {
      for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
        const batch = items.slice(offset, offset + BATCH_SIZE)
        const use_savepoint = batch.length > 1
        const savepoint = use_savepoint ? `sp_${++this.#savepoint_counter}` : ''
        if (use_savepoint)
          await this.#connection.execute(`SAVEPOINT ${savepoint}`)
        try {
          for (const row of batch) {
            const row_data = row as Record<string, unknown>
            if (is_syncable) {
              if (row_data.dirty === undefined)
                row_data.dirty = 1
              if (!row_data.updated_at)
                row_data.updated_at = new Date().toISOString()
            }
            const stringified = stringify_row(table_name, { ...row_data })
            const params = columns.map(col => stringified[col])
            await this.#connection.execute(sql, params)
          }
          if (use_savepoint)
            await this.#connection.execute(`RELEASE ${savepoint}`)
        } catch (batch_error) {
          if (use_savepoint)
            await this.#connection.execute(`ROLLBACK TO ${savepoint}`)
          throw batch_error
        }
      }
      this.#notifier.notify(table_name)
      this.#fire_dirty(table_name)
    } catch (error) {
      console.error('LiveDb upsert error:', error)
      throw error
    }
  }

  async #merge<T extends TableName>(table_name: T, set: InsertType<T> | InsertType<T>[]): Promise<void> {
    const items = Array.isArray(set) ? set : [set]
    if (items.length === 0)
      return

    const columns = Object.keys(items[0] as object)
    if (!columns.includes('updated_at'))
      throw new Error(`merge() requires 'updated_at' on input rows`)

    const is_syncable = is_syncable_table(table_name)
    if (is_syncable && !columns.includes('dirty'))
      columns.push('dirty')

    const BATCH_SIZE = 5000
    const columns_sql = columns.map(c => `"${c}"`).join(', ')
    const update_sql = columns.map(c => `"${c}" = excluded."${c}"`).join(', ')
    const placeholders = columns.map(() => '?').join(', ')
    const sql = `INSERT INTO "${table_name}" (${columns_sql}) VALUES (${placeholders})`
      + ` ON CONFLICT DO UPDATE SET ${update_sql}`
      + ` WHERE excluded."updated_at" > "${table_name}"."updated_at"`

    try {
      for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
        const batch = items.slice(offset, offset + BATCH_SIZE)
        const use_savepoint = batch.length > 1
        const savepoint = use_savepoint ? `sp_${++this.#savepoint_counter}` : ''
        if (use_savepoint)
          await this.#connection.execute(`SAVEPOINT ${savepoint}`)
        try {
          for (const row of batch) {
            const row_data = row as Record<string, unknown>
            if (is_syncable && row_data.dirty === undefined)
              row_data.dirty = 1
            const stringified = stringify_row(table_name, { ...row_data })
            const params = columns.map(col => stringified[col])
            await this.#connection.execute(sql, params)
          }
          if (use_savepoint)
            await this.#connection.execute(`RELEASE ${savepoint}`)
        } catch (batch_error) {
          if (use_savepoint)
            await this.#connection.execute(`ROLLBACK TO ${savepoint}`)
          throw batch_error
        }
      }
      this.#notifier.notify(table_name)
      this.#fire_dirty(table_name)
    } catch (error) {
      console.error('LiveDb merge error:', error)
      throw error
    }
  }

  async #update<T extends TableName>(table_name: T, set: UpdateType<T>): Promise<void> {
    const all_fields = { ...(set as Record<string, unknown>) }
    const keys = primary_keys_for(table_name)
    const key_values: Record<string, unknown> = {}
    for (const k of keys) {
      if (all_fields[k] === undefined)
        throw new Error(`update("${table_name}") missing primary key "${k}"`)
      key_values[k] = all_fields[k]
      delete all_fields[k]
    }
    const columns = Object.keys(all_fields)
    if (columns.length === 0)
      return

    const is_syncable = is_syncable_table(table_name)
    const stringified = stringify_row(table_name, { ...all_fields })
    const params: unknown[] = []
    const set_clauses = columns.map((col) => {
      params.push(stringified[col])
      return `"${col}" = ?`
    })
    if (is_syncable) {
      set_clauses.push('"dirty" = 1')
      set_clauses.push('"updated_at" = ?')
      params.push(new Date().toISOString())
    }
    const where = row_where(table_name, key_values)
    params.push(...where.params)

    const sql = `UPDATE "${table_name}" SET ${set_clauses.join(', ')} WHERE ${where.sql}`

    try {
      await this.#connection.execute(sql, params)
      this.#notifier.notify(table_name)
      this.#fire_dirty(table_name)
    } catch (error) {
      console.error('LiveDb update error:', error)
      throw error
    }
  }

  async #delete<T extends TableName>(table_name: T, keys_list: (string | Record<string, unknown>)[]): Promise<void> {
    const keys = primary_keys_for(table_name)
    if (keys.length !== 1)
      throw new Error(`Cannot delete from "${table_name}" — composite primary key tables are append-only`)
    try {
      for (const item of keys_list) {
        const id = typeof item === 'string' ? item : String(item[keys[0]])
        await this.#connection.execute(`INSERT INTO deletes (table_name, id) VALUES (?, ?)`, [table_name, id])
        await this.#connection.execute(`DELETE FROM "${table_name}" WHERE id = ?`, [id])
      }
      this.#notifier.notify(table_name)
      this.#notifier.notify('deletes')
      this.#fire_dirty(table_name)
    } catch (error) {
      console.error('LiveDb delete error:', error)
      throw error
    }
  }
}

export type LiveDb = LiveDbImpl & TableProperties

export function create_live_db(connection: SqliteConnection, options: LiveDbOptions = {}): LiveDb {
  const instance = new LiveDbImpl(connection, options)

  return new Proxy(instance, {
    get(target, prop, receiver) {
      if (prop in target || typeof prop === 'symbol') {
        const value = Reflect.get(target, prop, receiver)
        if (typeof value === 'function') {
          return value.bind(target)
        }
        return value
      }
      return target.get_table_accessor(prop as TableName)
    },
  }) as LiveDb
}
