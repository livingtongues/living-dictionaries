import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm'
import type * as dict_schema from '$lib/db/schemas/dictionary'
import type { DictConnection } from './dict-connection'
import { TableChangeNotifier } from '$lib/db/client/live/notifier'
import { reconcile_rows } from '$lib/db/client/live/reconcile-rows'
import { DICT_JSON_COLUMNS, parse_dict_row, stringify_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { DICT_SYNCABLE_TABLES } from '$lib/db/server/dictionary-sync-helpers'
import { tick } from 'svelte'

/**
 * Reactive Svelte 5 wrapper around a `DictConnection`. Mirrors the existing
 * `LiveDb` for admin.db (`lib/db/client/live/live-db.svelte.ts`) but talks to
 * a SharedWorker over `MessagePort` instead of a local wa-sqlite, and gets
 * cross-tab `tables_changed` broadcasts that trigger automatic re-queries.
 *
 * All dict.db tables use a synthetic UUID `id` PK (per Q8 in
 * port-db-sync-architecture.md) — no composite-key handling like admin's
 * `deletes`/`email_aliases`. That keeps this file short.
 */

type DictSchema = typeof dict_schema
export type DictTableName = {
  [K in keyof DictSchema]: DictSchema[K] extends Table ? K : never
}[keyof DictSchema]

export interface Saveable {
  _save: () => Promise<void>
  _delete: () => Promise<void>
  _reset: () => Promise<void>
}

export type DictRowType<T extends DictTableName> = DictSchema[T] extends Table
  ? InferSelectModel<DictSchema[T]> & Saveable
  : never

export type DictPlainRowType<T extends DictTableName> = DictSchema[T] extends Table
  ? InferSelectModel<DictSchema[T]>
  : never

/**
 * Insert shape: `id` is auto-generated when omitted, so we widen it to
 * optional vs Drizzle's `InferInsertModel` (which requires `id` since the
 * schema declares it `notNull primaryKey`).
 */
export type DictInsertType<T extends DictTableName> = DictSchema[T] extends Table
  ? Omit<InferInsertModel<DictSchema[T]>, 'id'> & { id?: string }
  : never

export type DictUpdateType<T extends DictTableName> = DictSchema[T] extends Table
  ? Partial<InferInsertModel<DictSchema[T]>> & { id: string }
  : never

export interface DictQueryOptions {
  where?: string
  params?: unknown[]
  order_by?: string
  limit?: number
  offset?: number
}

export interface DictQueryAccessor<T extends DictTableName> {
  readonly rows: DictRowType<T>[]
  readonly loading: boolean
  snapshot: () => Promise<DictPlainRowType<T>[]>
}

export interface DictTableAccessor<T extends DictTableName> {
  readonly loading: boolean
  readonly rows: DictRowType<T>[]
  readonly objects: Record<string, DictRowType<T>>
  id: (id: string) => DictRowType<T> | undefined
  find: (id: string) => Promise<DictRowType<T> | undefined>
  query: (options: DictQueryOptions) => DictQueryAccessor<T>
  insert: (item: DictInsertType<T> | DictInsertType<T>[]) => Promise<DictRowType<T>[]>
  upsert: (set: DictInsertType<T> | DictInsertType<T>[]) => Promise<void>
  update: (set: DictUpdateType<T>) => Promise<void>
  delete: (id: string | string[]) => Promise<void>
}

function is_dict_syncable(table: string): boolean {
  return (DICT_SYNCABLE_TABLES as readonly string[]).includes(table)
}

class DictTableStore<T extends Record<string, unknown>> {
  #rows = $state<T[]>([])
  #objects = $state<Record<string, T>>({})
  #loading = $state(true)
  #subscribers = 0
  #unsubscribe: (() => void) | null = null
  #stop_timer: ReturnType<typeof setTimeout> | null = null
  #started = false

  #connection: DictConnection
  #notifier: TableChangeNotifier
  #table_name: string
  #query: string
  #params: unknown[]
  #on_save: (row: Record<string, unknown>) => Promise<void>
  #on_delete: (id: string) => Promise<void>
  #on_reset: (row: Record<string, unknown>) => Promise<void>

  constructor(options: {
    connection: DictConnection
    notifier: TableChangeNotifier
    table_name: string
    query: string
    params: unknown[]
    on_save: (row: Record<string, unknown>) => Promise<void>
    on_delete: (id: string) => Promise<void>
    on_reset: (row: Record<string, unknown>) => Promise<void>
  }) {
    this.#connection = options.connection
    this.#notifier = options.notifier
    this.#table_name = options.table_name
    this.#query = options.query
    this.#params = options.params
    this.#on_save = options.on_save
    this.#on_delete = options.on_delete
    this.#on_reset = options.on_reset
  }

  get rows(): T[] { this.#track(); return this.#rows }
  get objects(): Record<string, T> { this.#track(); return this.#objects }
  get loading(): boolean { this.#track(); return this.#loading }

  #track() {
    if ($effect.tracking()) {
      $effect(() => {
        if (this.#subscribers === 0 && !this.#started)
          this.#start()
        this.#subscribers++
        return () => {
          tick().then(() => {
            this.#subscribers--
            if (this.#subscribers === 0)
              this.#schedule_stop()
          })
        }
      })
    }
  }

  async #start() {
    if (this.#stop_timer) { clearTimeout(this.#stop_timer); this.#stop_timer = null }
    this.#started = true
    this.#loading = true
    try {
      await this.#refresh()
      this.#loading = false
      this.#unsubscribe = this.#notifier.subscribe(this.#table_name, () => { void this.#refresh() })
    } catch (err) {
      console.error('DictTableStore start error:', err)
      this.#loading = false
      this.#started = false
    }
  }

  async #refresh() {
    const fresh_rows = await this.#connection.query<T>(this.#query, this.#params)
    if (DICT_JSON_COLUMNS[this.#table_name])
      for (const row of fresh_rows) parse_dict_row(this.#table_name, row as Record<string, unknown>)
    reconcile_rows<T>({
      rows: this.#rows,
      objects: this.#objects,
      fresh_rows,
      row_key: row => String(row.id),
      on_row_added: row => this.#attach_methods(row as T & Saveable),
    })
    for (const row of this.#rows) {
      const key = String((row as unknown as { id: unknown }).id)
      if (this.#objects[key] && !(this.#objects[key] as T & Partial<Saveable>)._save)
        this.#attach_methods(this.#objects[key] as T & Saveable)
    }
  }

  #attach_methods(row: T & Saveable) {
    row._save = async () => { await this.#on_save(row as Record<string, unknown>) }
    row._delete = async () => { await this.#on_delete(String((row as unknown as { id: unknown }).id)) }
    row._reset = async () => { await this.#on_reset(row as Record<string, unknown>) }
  }

  #schedule_stop() {
    if (this.#stop_timer) return
    this.#stop_timer = setTimeout(() => {
      this.#stop_timer = null
      if (this.#subscribers === 0) this.#stop()
    }, 5000)
  }

  #stop() {
    this.#unsubscribe?.()
    this.#unsubscribe = null
    this.#started = false
  }
}

class DictLiveDbImpl {
  #connection: DictConnection
  #notifier = new TableChangeNotifier()
  #unsubscribe_broadcasts: (() => void) | null = null

  #table_stores = new Map<string, DictTableStore<Record<string, unknown>>>()
  #row_stores = new Map<string, DictTableStore<Record<string, unknown>>>()
  #query_stores = new Map<string, DictTableStore<Record<string, unknown>>>()
  #has_id_column_cache = new Map<string, boolean>()
  #savepoint_counter = 0

  constructor(connection: DictConnection) {
    this.#connection = connection
    this.#unsubscribe_broadcasts = connection.subscribe_broadcasts((broadcast) => {
      if (broadcast.type === 'tables_changed') {
        for (const table of broadcast.tables) this.#notifier.notify(table)
      }
    })
  }

  /** Called by the connection-holding component on unmount. */
  destroy() {
    this.#unsubscribe_broadcasts?.()
    this.#unsubscribe_broadcasts = null
  }

  notify_table(table_name: string): void {
    this.#notifier.notify(table_name)
  }

  subscribe = (table_name: string, callback: () => void) => this.#notifier.subscribe(table_name, callback)

  get_table_accessor<T extends DictTableName>(table_name: T): DictTableAccessor<T> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    return {
      get loading(): boolean { return self.#get_table_store(table_name).loading },
      get rows(): DictRowType<T>[] { return self.#get_table_store(table_name).rows as DictRowType<T>[] },
      get objects(): Record<string, DictRowType<T>> { return self.#get_table_store(table_name).objects as Record<string, DictRowType<T>> },
      id(id: string): DictRowType<T> | undefined {
        if (!id) return undefined
        // svelte-ignore state_referenced_locally
        const rows = $derived(self.#get_row_store(table_name, id).rows)
        return rows[0] as DictRowType<T> | undefined
      },
      async find(id: string): Promise<DictRowType<T> | undefined> {
        if (!id) return undefined
        const rows = await self.#connection.query<Record<string, unknown>>(
          `SELECT * FROM "${table_name}" WHERE id = ? LIMIT 1`,
          [id],
        )
        if (rows[0]) parse_dict_row(table_name, rows[0])
        return rows[0] as DictRowType<T> | undefined
      },
      query(options: DictQueryOptions): DictQueryAccessor<T> {
        return self.#create_query_accessor(table_name, options)
      },
      insert(item: DictInsertType<T> | DictInsertType<T>[]): Promise<DictRowType<T>[]> {
        return self.#insert(table_name, item)
      },
      upsert(set: DictInsertType<T> | DictInsertType<T>[]): Promise<void> {
        return self.#upsert(table_name, set)
      },
      update(set: DictUpdateType<T>): Promise<void> {
        return self.#update(table_name, set)
      },
      delete(ids: string | string[]): Promise<void> {
        const list = Array.isArray(ids) ? ids : [ids]
        return self.#delete(table_name, list)
      },
    }
  }

  #get_table_store(table_name: string): DictTableStore<Record<string, unknown>> {
    let store = this.#table_stores.get(table_name)
    if (!store) {
      store = new DictTableStore({
        connection: this.#connection,
        notifier: this.#notifier,
        table_name,
        query: `SELECT * FROM "${table_name}" WHERE deleted IS NULL`,
        params: [],
        on_save: this.#save_cb(table_name),
        on_delete: this.#delete_cb(table_name),
        on_reset: this.#reset_cb(table_name),
      })
      this.#table_stores.set(table_name, store)
    }
    return store
  }

  #get_row_store(table_name: string, id: string): DictTableStore<Record<string, unknown>> {
    const key = `${table_name}:${id}`
    let store = this.#row_stores.get(key)
    if (!store) {
      store = new DictTableStore({
        connection: this.#connection,
        notifier: this.#notifier,
        table_name,
        query: `SELECT * FROM "${table_name}" WHERE id = ?`,
        params: [id],
        on_save: this.#save_cb(table_name),
        on_delete: this.#delete_cb(table_name),
        on_reset: this.#reset_cb(table_name),
      })
      this.#row_stores.set(key, store)
    }
    return store
  }

  #create_query_accessor<T extends DictTableName>(table_name: T, options: DictQueryOptions): DictQueryAccessor<T> {
    let sql = `SELECT * FROM "${table_name}"`
    if (options.where) sql += ` WHERE ${options.where}`
    if (options.order_by) sql += ` ORDER BY ${options.order_by}`
    if (options.limit !== undefined) sql += ` LIMIT ${options.limit}`
    if (options.offset !== undefined) sql += ` OFFSET ${options.offset}`
    const params = options.params ?? []
    const key = JSON.stringify({ sql, params })
    let store = this.#query_stores.get(key)
    if (!store) {
      store = new DictTableStore({
        connection: this.#connection,
        notifier: this.#notifier,
        table_name,
        query: sql,
        params,
        on_save: this.#save_cb(table_name),
        on_delete: this.#delete_cb(table_name),
        on_reset: this.#reset_cb(table_name),
      })
      this.#query_stores.set(key, store)
    }
    return {
      get rows(): DictRowType<T>[] { return store.rows as DictRowType<T>[] },
      get loading(): boolean { return store.loading },
      snapshot: async (): Promise<DictPlainRowType<T>[]> => {
        const rows = await this.#connection.query<DictPlainRowType<T>>(sql, params)
        for (const row of rows) parse_dict_row(table_name, row as Record<string, unknown>)
        return rows
      },
    }
  }

  async #check_id_column(table: string): Promise<boolean> {
    const cached = this.#has_id_column_cache.get(table)
    if (cached !== undefined) return cached
    const cols = await this.#connection.query<{ name: string }>(`PRAGMA table_info("${table}")`)
    const has = cols.some(c => c.name === 'id')
    this.#has_id_column_cache.set(table, has)
    return has
  }

  #save_cb(table: string) {
    return async (row: Record<string, unknown>) => {
      if (!row.id) {
        console.warn('DictLiveDb save: row missing id')
        return
      }
      // Skip columns that should never be hand-set on save:
      //   - PK & creation provenance are immutable post-insert
      //   - dirty + updated_at are appended below explicitly so a row that
      //     was previously cleaned (`dirty = NULL`) flips back to dirty=1
      const exclude = new Set([
        'id',
        'created_at',
        'created_by_user_id',
        'dirty',
        'updated_at',
        '_save',
        '_delete',
        '_reset',
      ])
      const columns = Object.keys(row).filter(c => !exclude.has(c))
      const stringified = stringify_dict_row(table, { ...row })

      const clauses: string[] = []
      const params: unknown[] = []
      for (const col of columns) {
        clauses.push(`"${col}" = ?`)
        params.push(stringified[col])
      }
      clauses.push('"dirty" = 1')
      clauses.push('"updated_at" = ?')
      params.push(new Date().toISOString())
      params.push(row.id)

      try {
        await this.#connection.execute(`UPDATE "${table}" SET ${clauses.join(', ')} WHERE id = ?`, params)
        this.#notifier.notify(table)
      } catch (err) {
        console.error('DictLiveDb save error:', err)
        throw err
      }
    }
  }

  #delete_cb(table: string) {
    return async (id: string) => {
      try {
        const now = new Date().toISOString()
        await this.#connection.execute(`INSERT OR REPLACE INTO deletes (table_name, id, updated_at) VALUES (?, ?, ?)`, [table, id, now])
        this.#notifier.notify(table)
        this.#notifier.notify('deletes')
      } catch (err) {
        console.error('DictLiveDb delete error:', err)
        throw err
      }
    }
  }

  #reset_cb(table: string) {
    return async (row: Record<string, unknown>) => {
      if (!row.id) return
      try {
        const rows = await this.#connection.query<Record<string, unknown>>(`SELECT * FROM "${table}" WHERE id = ?`, [row.id])
        if (rows[0]) {
          parse_dict_row(table, rows[0])
          for (const key of Object.keys(rows[0])) row[key] = rows[0][key]
        }
      } catch (err) {
        console.error('DictLiveDb reset error:', err)
        throw err
      }
    }
  }

  async #insert<T extends DictTableName>(table_name: T, set: DictInsertType<T> | DictInsertType<T>[]): Promise<DictRowType<T>[]> {
    const items = Array.isArray(set) ? set : [set]
    if (items.length === 0) return []
    const has_id_column = await this.#check_id_column(table_name)
    const syncable = is_dict_syncable(table_name)
    const results: DictRowType<T>[] = []
    const BATCH = 500
    for (let offset = 0; offset < items.length; offset += BATCH) {
      const batch = items.slice(offset, offset + BATCH)
      const use_sp = batch.length > 1
      const sp = use_sp ? `sp_${++this.#savepoint_counter}` : ''
      if (use_sp) await this.#connection.execute(`SAVEPOINT ${sp}`)
      try {
        for (const item of batch) {
          const row_data = { ...item } as Record<string, unknown>
          if (has_id_column && !row_data.id) row_data.id = crypto.randomUUID()
          if (syncable) {
            if (row_data.dirty === undefined) row_data.dirty = 1
            if (!row_data.updated_at) row_data.updated_at = new Date().toISOString()
            if (!row_data.created_at) row_data.created_at = row_data.updated_at
          }
          const stringified = stringify_dict_row(table_name, { ...row_data })
          const columns = Object.keys(stringified)
          const placeholders = columns.map(() => '?').join(', ')
          const values = columns.map(c => stringified[c])
          await this.#connection.execute(
            `INSERT INTO "${table_name}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
            values,
          )
          if (has_id_column && row_data.id) {
            const echo = await this.#connection.query<Record<string, unknown>>(
              `SELECT * FROM "${table_name}" WHERE id = ?`,
              [row_data.id],
            )
            if (echo[0]) {
              parse_dict_row(table_name, echo[0])
              results.push(echo[0] as DictRowType<T>)
            }
          }
        }
        if (use_sp) await this.#connection.execute(`RELEASE ${sp}`)
      } catch (err) {
        if (use_sp) await this.#connection.execute(`ROLLBACK TO ${sp}`)
        throw err
      }
    }
    this.#notifier.notify(table_name)
    return results
  }

  async #upsert<T extends DictTableName>(table_name: T, set: DictInsertType<T> | DictInsertType<T>[]): Promise<void> {
    const items = Array.isArray(set) ? set : [set]
    if (items.length === 0) return
    const syncable = is_dict_syncable(table_name)
    const BATCH = 500
    for (let offset = 0; offset < items.length; offset += BATCH) {
      const batch = items.slice(offset, offset + BATCH)
      const use_sp = batch.length > 1
      const sp = use_sp ? `sp_${++this.#savepoint_counter}` : ''
      if (use_sp) await this.#connection.execute(`SAVEPOINT ${sp}`)
      try {
        for (const row of batch) {
          const row_data = { ...row } as Record<string, unknown>
          if (syncable) {
            if (row_data.dirty === undefined) row_data.dirty = 1
            if (!row_data.updated_at) row_data.updated_at = new Date().toISOString()
          }
          const stringified = stringify_dict_row(table_name, { ...row_data })
          const columns = Object.keys(stringified)
          const placeholders = columns.map(() => '?').join(', ')
          const update_set = columns.map(c => `"${c}" = excluded."${c}"`).join(', ')
          const values = columns.map(c => stringified[c])
          await this.#connection.execute(
            `INSERT INTO "${table_name}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${update_set}`,
            values,
          )
        }
        if (use_sp) await this.#connection.execute(`RELEASE ${sp}`)
      } catch (err) {
        if (use_sp) await this.#connection.execute(`ROLLBACK TO ${sp}`)
        throw err
      }
    }
    this.#notifier.notify(table_name)
  }

  async #update<T extends DictTableName>(table_name: T, set: DictUpdateType<T>): Promise<void> {
    const all_fields = { ...(set as Record<string, unknown>) }
    const id = all_fields.id as string
    if (!id) throw new Error(`update("${table_name}") missing id`)
    delete all_fields.id
    const columns = Object.keys(all_fields)
    if (columns.length === 0) return
    const stringified = stringify_dict_row(table_name, { ...all_fields })
    const params: unknown[] = []
    const set_clauses = columns.map((col) => {
      params.push(stringified[col])
      return `"${col}" = ?`
    })
    if (is_dict_syncable(table_name)) {
      set_clauses.push('"dirty" = 1')
      set_clauses.push('"updated_at" = ?')
      params.push(new Date().toISOString())
    }
    params.push(id)
    await this.#connection.execute(
      `UPDATE "${table_name}" SET ${set_clauses.join(', ')} WHERE id = ?`,
      params,
    )
    this.#notifier.notify(table_name)
  }

  async #delete<T extends DictTableName>(table_name: T, ids: string[]): Promise<void> {
    const now = new Date().toISOString()
    for (const id of ids) {
      await this.#connection.execute(
        `INSERT OR REPLACE INTO deletes (table_name, id, updated_at) VALUES (?, ?, ?)`,
        [table_name, id, now],
      )
    }
    this.#notifier.notify(table_name)
    this.#notifier.notify('deletes')
  }
}

type DictTableProperties = { [K in DictTableName]: DictTableAccessor<K> }
export type DictLiveDb = DictLiveDbImpl & DictTableProperties

export function create_dict_live_db(connection: DictConnection): DictLiveDb {
  const instance = new DictLiveDbImpl(connection)
  return new Proxy(instance, {
    get(target, prop, receiver) {
      if (prop in target || typeof prop === 'symbol') {
        const value = Reflect.get(target, prop, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      }
      return target.get_table_accessor(prop as DictTableName)
    },
  }) as DictLiveDb
}
