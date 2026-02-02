import type { PGliteWithLive } from '@electric-sql/pglite/live'
import type {
  InsertType,
  QueryAccessor,
  QueryOptions,
  RowType,
  TableAccessor,
  TableName,
} from './types'
import { TableStore } from './table-store.svelte'

export interface LivePgLiteOptions {
  log?: boolean
}

// Type for direct table access - db.labels, db.tasks, etc.
type TableProperties = {
  [K in TableName]: TableAccessor<K>
}

/**
 * LivePgLite provides a reactive Svelte 5 interface to PGLite.
 * Access tables directly via db.labels.rows with automatic subscriptions.
 */
class LivePgLiteImpl {
  #pg: PGliteWithLive
  #options: LivePgLiteOptions

  // Store instances for full table subscriptions
  #table_stores = new Map<string, TableStore<Record<string, unknown>>>()

  // Store instances for single-row subscriptions (by table.id)
  #row_stores = new Map<string, TableStore<Record<string, unknown>>>()

  // Store instances for custom queries (keyed by SQL+params hash)
  #query_stores = new Map<string, TableStore<Record<string, unknown>>>()

  constructor(pg: PGliteWithLive, options: LivePgLiteOptions = {}) {
    this.#pg = pg
    this.#options = options
  }

  /**
   * Get a table accessor by name (used by the proxy)
   */
  get_table_accessor<T extends TableName>(table_name: T): TableAccessor<T> {
    return this.#get_table_accessor(table_name)
  }

  /**
   * Get or create a TableAccessor for the given table name
   */
  #get_table_accessor<T extends TableName>(table_name: T): TableAccessor<T> {
    const self = this

    return {
      get rows(): RowType<T>[] {
        return self.#get_or_create_table_store(table_name).rows as RowType<T>[]
      },

      get objects(): Record<string, RowType<T>> {
        return self.#get_or_create_table_store(table_name).objects as Record<string, RowType<T>>
      },

      get loading(): boolean {
        return self.#get_or_create_table_store(table_name).loading
      },

      get id() {
        return new Proxy({}, {
          get(_: unknown, id: string) {
            if (id == null || id === 'undefined' || id === 'null')
              return undefined
            return self.#get_row_by_id(table_name, id)
          },
        }) as Readonly<Record<string, RowType<T> | undefined>>
      },

      query(options: QueryOptions): QueryAccessor<T> {
        return self.#create_query_accessor(table_name, options)
      },

      insert(item: InsertType<T> | InsertType<T>[]): Promise<RowType<T>[]> {
        return self.#insert(table_name, item)
      },

      delete_all(ids: string[]): Promise<void> {
        return self.#delete_all(table_name, ids)
      },
    }
  }

  /**
   * Get or create a TableStore for a full table subscription
   */
  #get_or_create_table_store<T extends TableName>(
    table_name: T,
  ): TableStore<Record<string, unknown>> {
    let store = this.#table_stores.get(table_name)

    if (!store) {
      store = new TableStore({
        pg: this.#pg,
        query: `SELECT * FROM "${table_name}"`,
        params: [],
        log: this.#options.log,
        on_save: this.#create_save_callback(table_name),
        on_delete: this.#create_delete_callback(table_name),
        on_reset: this.#create_reset_callback(table_name),
      })
      this.#table_stores.set(table_name, store)
    }

    return store
  }

  /**
   * Create a save callback for a given table
   */
  #create_save_callback(table_name: TableName): (row: Record<string, unknown>) => Promise<void> {
    return async (row: Record<string, unknown>) => {
      const id = row.id as string
      if (!id) {
        console.warn('LivePgLite save: row has no id')
        return
      }

      // Build UPDATE statement from all columns except 'id', 'created_at', and method properties
      const exclude_columns = ['id', 'created_at', '_save', '_delete', '_reset']
      const columns = Object.keys(row).filter(col => !exclude_columns.includes(col))

      // Prepare params - update updated_at to current timestamp if column exists
      const params: unknown[] = columns.map((col) => {
        if (col === 'updated_at') {
          return new Date()
        }
        return row[col]
      })
      params.push(id)

      const set_clauses = columns.map((col, i) => `"${col}" = $${i + 1}`).join(', ')
      const sql = `UPDATE "${table_name}" SET ${set_clauses} WHERE id = $${columns.length + 1}`

      try {
        await this.#pg.query(sql, params)
      } catch (error) {
        console.error('LivePgLite save error:', error)
        this.#show_toast(`Save error: ${(error as Error).message}`)
        throw error
      }
    }
  }

  /**
   * Create a delete callback for a given table
   */
  #create_delete_callback(table_name: TableName): (id: string) => Promise<void> {
    return async (id: string) => {
      const sql = `DELETE FROM "${table_name}" WHERE id = $1`

      try {
        await this.#pg.query(sql, [id])
      } catch (error) {
        console.error('LivePgLite delete error:', error)
        this.#show_toast(`Delete error: ${(error as Error).message}`)
        throw error
      }
    }
  }

  /**
   * Create a reset callback for a given table - reads fresh data from DB
   */
  #create_reset_callback(table_name: TableName): (row: Record<string, unknown>) => Promise<void> {
    return async (row: Record<string, unknown>) => {
      const id = row.id as string
      if (!id) {
        console.warn('LivePgLite reset: row has no id')
        return
      }

      const sql = `SELECT * FROM "${table_name}" WHERE id = $1`

      try {
        const result = await this.#pg.query<Record<string, unknown>>(sql, [id])
        const [dbRow] = result.rows
        if (dbRow) {
          // Copy all values from DB back to the row object
          for (const key of Object.keys(dbRow)) {
            row[key] = dbRow[key]
          }
        }
      } catch (error) {
        console.error('LivePgLite reset error:', error)
        this.#show_toast(`Reset error: ${(error as Error).message}`)
        throw error
      }
    }
  }

  /**
   * Get a single row by ID with its own efficient subscription
   */
  #get_row_by_id<T extends TableName>(
    table_name: T,
    id: string,
  ): RowType<T> | undefined {
    const store_key = `${table_name}:${id}`
    let store = this.#row_stores.get(store_key)

    if (!store) {
      // Create a dedicated store for this single row
      store = new TableStore({
        pg: this.#pg,
        query: `SELECT * FROM "${table_name}" WHERE id = $1`,
        params: [id],
        log: this.#options.log,
        on_save: this.#create_save_callback(table_name),
        on_delete: this.#create_delete_callback(table_name),
        on_reset: this.#create_reset_callback(table_name),
      })
      this.#row_stores.set(store_key, store)
    }

    const { rows } = store
    return rows[0] as RowType<T> | undefined
  }

  /**
   * Create a QueryAccessor for a custom query
   */
  #create_query_accessor<T extends TableName>(
    table_name: T,
    options: QueryOptions,
  ): QueryAccessor<T> {
    const sql = this.#build_query_sql(table_name, options)
    const params = options.params ?? []
    const query_key = this.#get_query_key(sql, params)

    let store = this.#query_stores.get(query_key)

    if (!store) {
      store = new TableStore({
        pg: this.#pg,
        query: sql,
        params,
        log: this.#options.log,
        on_save: this.#create_save_callback(table_name),
        on_delete: this.#create_delete_callback(table_name),
        on_reset: this.#create_reset_callback(table_name),
      })
      this.#query_stores.set(query_key, store)
    }

    const self = this
    return {
      get rows(): RowType<T>[] {
        return store!.rows as RowType<T>[]
      },
      get loading(): boolean {
        return store!.loading
      },
    }
  }

  /**
   * Build SQL query from QueryOptions
   */
  #build_query_sql(table_name: TableName, options: QueryOptions): string {
    let sql = `SELECT * FROM "${table_name}"`

    if (options.where) {
      sql += ` WHERE ${options.where}`
    }

    if (options.order_by) {
      sql += ` ORDER BY ${options.order_by}`
    }

    if (options.limit !== undefined) {
      sql += ` LIMIT ${options.limit}`
    }

    if (options.offset !== undefined) {
      sql += ` OFFSET ${options.offset}`
    }

    return sql
  }

  /**
   * Generate a cache key for a query
   */
  #get_query_key(sql: string, params: unknown[]): string {
    return JSON.stringify({ sql, params })
  }

  /**
   * Insert one or more rows into a table
   */
  async #insert<T extends TableName>(
    table_name: T,
    item: InsertType<T> | InsertType<T>[],
  ): Promise<RowType<T>[]> {
    const items = Array.isArray(item) ? item : [item]
    const columns = Object.keys(items[0] as object)

    const results: RowType<T>[] = []

    for (const row of items) {
      const values = columns.map((_, i) => `$${i + 1}`).join(', ')
      const params = columns.map(col => (row as Record<string, unknown>)[col])

      const sql = `INSERT INTO "${table_name}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values}) RETURNING *`

      try {
        const result = await this.#pg.query<RowType<T>>(sql, params)
        if (result.rows[0]) {
          results.push(result.rows[0])
        }
      } catch (error) {
        console.error('LivePgLite insert error:', error)
        this.#show_toast(`Insert error: ${(error as Error).message}`)
        throw error
      }
    }

    return results
  }

  /**
   * Delete multiple rows by their IDs
   */
  async #delete_all<T extends TableName>(
    table_name: T,
    ids: string[],
  ): Promise<void> {
    // Build a single DELETE query with IN clause
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    const sql = `DELETE FROM "${table_name}" WHERE id IN (${placeholders})`

    try {
      await this.#pg.query(sql, ids)
    } catch (error) {
      console.error('LivePgLite deleteAll error:', error)
      this.#show_toast(`Delete error: ${(error as Error).message}`)
      throw error
    }
  }

  /**
   * Simple toast notification for errors
   */
  #show_toast(message: string) {
    if (typeof document === 'undefined')
      return

    const toast = document.createElement('div')
    toast.className = 'live-pglite-toast'
    toast.textContent = message
    toast.style.cssText = `
      position: fixed; bottom: 1rem; right: 1rem;
      background: #dc2626; color: white;
      padding: 0.75rem 1rem; border-radius: 0.5rem;
      z-index: 9999; font-family: system-ui, sans-serif;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 5000)
  }
}

/**
 * LivePgLite type - allows direct table access via db.labels, db.tasks, etc.
 */
export type LivePgLite = LivePgLiteImpl & TableProperties

/**
 * Create a LivePgLite instance with direct table access via proxy
 */
export function create_live_pglite(pg: PGliteWithLive, options: LivePgLiteOptions = {}): LivePgLite {
  const instance = new LivePgLiteImpl(pg, options)

  return new Proxy(instance, {
    get(target, prop, receiver) {
      // First check if it's a property on the instance itself
      if (prop in target || typeof prop === 'symbol') {
        return Reflect.get(target, prop, receiver)
      }
      // Otherwise, treat it as a table name
      return target.get_table_accessor(prop as TableName)
    },
  }) as LivePgLite
}
