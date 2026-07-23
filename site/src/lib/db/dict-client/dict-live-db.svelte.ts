import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm'
import type { MultiString } from '$lib/types'
import type * as dict_schema from '$lib/db/schemas/dictionary'
import type { DictWriteOp, DictWriteOutcome, JunctionTable, TokenLinkAction } from './dict-writes'
import type { DictConnection } from './worker-connection'
import { construct_outside_reaction } from '$lib/db/client/live/construct-outside-reaction.svelte'
import { TableChangeNotifier } from '$lib/db/client/live/notifier'
import { compute_retry_decision, log_live_query_failed, log_live_query_recovered, log_live_query_timeout } from '$lib/db/client/live/live-query-retry'
import { reconcile_rows } from '$lib/db/client/live/reconcile-rows'
import { DICT_JSON_COLUMNS, parse_dict_row, stringify_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { save_changed_dict_columns } from './dict-save-row'
import { DICT_SYNCABLE_TABLES } from '$lib/db/dict-syncable-tables'
import { log_warning } from '$lib/debug/remote-log'
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
 * Columns the write paths auto-fill on insert (PK + audit + sync bookkeeping),
 * so callers never have to pass them. See the auto-stamping in `#insert`.
 */
type DictAutoColumn = 'id' | 'created_at' | 'created_by_user_id' | 'updated_at' | 'updated_by_user_id' | 'dirty'

/**
 * Insert shape: the auto-stamped columns above are optional (the write path
 * generates the `id` and stamps audit + sync columns), so callers only provide
 * real content. Everything else mirrors Drizzle's `InferInsertModel`.
 */
export type DictInsertType<T extends DictTableName> = DictSchema[T] extends Table
  ? Omit<InferInsertModel<DictSchema[T]>, DictAutoColumn>
    & Partial<Pick<InferInsertModel<DictSchema[T]>, Extract<keyof InferInsertModel<DictSchema[T]>, DictAutoColumn>>>
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

/**
 * Typed facade over the worker-side atomic multi-table writes (`dict-writes.ts`,
 * mirror of house's `admin-writes.ts`). Each call is ONE `dict_write` RPC; the
 * leader runs the orchestrator inside `BEGIN/COMMIT` under the op-mutex. The
 * facade injects the current `user_id` for audit stamping.
 */
export interface DictWrites {
  insert_entry: (args: { lexeme: MultiString }) => Promise<DictPlainRowType<'entries'>>
  insert_sentence: (args: { sentence: DictInsertType<'sentences'>, sense_id: string }) => Promise<DictPlainRowType<'sentences'>>
  insert_sentences: (args: { rows: DictInsertType<'sentences'>[] }) => Promise<DictPlainRowType<'sentences'>[]>
  update_sentence: (args: { sentence: DictUpdateType<'sentences'> }) => Promise<DictPlainRowType<'sentences'>>
  analyze_sentences: (args: { text_id?: string, sentence_ids?: string[] }) => Promise<{ analyzed: number, changed: number }>
  set_token_link: (args: { sentence_id: string, orthography: string, token_index: number, action: TokenLinkAction, entry_id?: string, sense_id?: string }) => Promise<DictPlainRowType<'sentences'>>
  create_entry_from_token: (args: { lexeme: MultiString, sentence_id: string, orthography: string, token_index: number }) => Promise<DictPlainRowType<'entries'>>
  ignore_form: (args: { form: string }) => Promise<{ sentences_changed: number, occurrences: number }>
  insert_text: (args: { title: MultiString, sentences: { text: MultiString, ends_paragraph?: number }[] }) => Promise<DictPlainRowType<'texts'>>
  insert_audio: (args: { audio: DictInsertType<'audio'>, speaker_id?: string }) => Promise<DictPlainRowType<'audio'>>
  insert_photo: (args: { photo: DictInsertType<'photos'>, sense_id: string }) => Promise<DictPlainRowType<'photos'>>
  insert_video: (args: { video: DictInsertType<'videos'>, sense_id: string, speaker_id?: string }) => Promise<DictPlainRowType<'videos'>>
  link_junction: (args: { table: JunctionTable, key: Record<string, string> }) => Promise<{ linked: boolean }>
  unlink_junction: (args: { table: JunctionTable, key: Record<string, string> }) => Promise<{ unlinked: boolean }>
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
  #retry_timer: ReturnType<typeof setTimeout> | null = null
  #attempt = 0
  #failed_at = 0
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
    if (this.#retry_timer) { clearTimeout(this.#retry_timer); this.#retry_timer = null }
    this.#started = true
    this.#loading = true
    this.#attempt = 0
    this.#failed_at = 0
    await this.#load_and_subscribe()
  }

  // Run the query and, on success, subscribe to change notifications. A transient
  // leader-worker timeout (`RPC timed out (no leader responded)`) retries with
  // backoff instead of permanently dead-paneling the view. Ported from house —
  // see `$lib/db/client/live/live-query-retry.ts`.
  async #load_and_subscribe() {
    if (!this.#started)
      return
    const started_at = Date.now()
    try {
      await this.#refresh()
      this.#loading = false
      if (this.#failed_at) {
        log_live_query_recovered({ table: this.#table_name, source: 'dict', attempts: this.#attempt, total_wait_ms: Date.now() - this.#failed_at, had_leader: this.#had_leader() })
        this.#failed_at = 0
      }
      this.#attempt = 0
      this.#unsubscribe = this.#notifier.subscribe(this.#table_name, () => { void this.#refresh() })
    } catch (err) {
      this.#on_query_error(err, Date.now() - started_at)
    }
  }

  #on_query_error(error: unknown, waited_ms: number) {
    if (!this.#started)
      return // stopped (unmounted) while the query was in flight
    if (this.#subscribers === 0) {
      this.#loading = false
      this.#started = false
      return
    }
    const had_leader = this.#had_leader()
    const { will_retry, delay_ms } = compute_retry_decision({ error, attempt: this.#attempt, has_subscribers: this.#subscribers > 0 })
    if (will_retry) {
      if (!this.#failed_at)
        this.#failed_at = Date.now()
      log_live_query_timeout({ table: this.#table_name, source: 'dict', waited_ms, attempt: this.#attempt, will_retry: true, had_leader })
      this.#attempt++
      // Keep #loading = true so the UI shows a spinner (not an empty panel) while we recover.
      this.#retry_timer = setTimeout(() => {
        this.#retry_timer = null
        void this.#load_and_subscribe()
      }, delay_ms)
    } else {
      log_live_query_failed({ table: this.#table_name, source: 'dict', waited_ms, attempts: this.#attempt, had_leader, code: (error as { code?: string } | null)?.code ?? null })
      this.#loading = false
      this.#started = false
    }
  }

  #had_leader(): boolean | null {
    return this.#connection.has_leader?.() ?? null
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
    if (this.#retry_timer) { clearTimeout(this.#retry_timer); this.#retry_timer = null }
    this.#unsubscribe?.()
    this.#unsubscribe = null
    this.#started = false
  }
}

class DictLiveDbImpl {
  #connection: DictConnection
  #notifier = new TableChangeNotifier()
  #delete_subscribers = new Set<(deletes: { table_name: string, id: string }[]) => void>()
  #unsubscribe_broadcasts: (() => void) | null = null

  // Current editing user. Every syncable content table carries NOT NULL
  // `created_by_user_id` / `updated_by_user_id`; when this is set the write
  // paths auto-stamp them so components can mutate-then-`_save()` without a
  // wrapper layer doing it (the old `db_operations` layer used to). Kept mutable via
  // `set_user_id` because the dict_db is cached across layout invalidations, so
  // a login/logout while a dict is open must update who gets stamped.
  #user_id: string | undefined

  #table_stores = new Map<string, DictTableStore<Record<string, unknown>>>()
  #row_stores = new Map<string, DictTableStore<Record<string, unknown>>>()
  #query_stores = new Map<string, DictTableStore<Record<string, unknown>>>()
  #writes: DictWrites | null = null

  constructor(connection: DictConnection, options: { user_id?: string } = {}) {
    this.#connection = connection
    this.#user_id = options.user_id
    this.#unsubscribe_broadcasts = connection.subscribe_broadcasts((broadcast) => {
      if (broadcast.type === 'tables_changed') {
        for (const table of broadcast.tables) this.#notifier.notify(table)
      } else if (broadcast.type === 'rows_deleted') {
        // A sync pull hard-deleted these rows — let the search index drop them
        // (the rows are gone, so a table re-query alone can't surface removal).
        this.#notify_deletes(broadcast.deletes)
      }
    })
  }

  /**
   * Subscribe to hard-delete events (local deletes + sync-pulled deletes).
   * The Orama search watcher uses this to drop removed rows from its in-memory
   * index, since a hard-deleted row vanishes from the `updated_at` delta scan.
   */
  subscribe_deletes = (callback: (deletes: { table_name: string, id: string }[]) => void) => {
    this.#delete_subscribers.add(callback)
    return () => { this.#delete_subscribers.delete(callback) }
  }

  #notify_deletes(deletes: { table_name: string, id: string }[]): void {
    if (deletes.length === 0) return
    for (const callback of this.#delete_subscribers) {
      try { callback(deletes) } catch (err) { console.error('DictLiveDb delete subscriber threw:', err) }
    }
  }

  set_user_id(user_id: string | undefined): void {
    this.#user_id = user_id
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
        // Direct read: in a tracked context the deps flow straight to the row
        // store's signals (constructed outside the reaction, so they register);
        // in an event handler `#track` no-ops. A nested `$derived` here would
        // itself be "own state" of the calling reaction (push_reaction_value
        // covers deriveds too) and freeze the caller — see
        // construct-outside-reaction.svelte.ts.
        return self.#get_row_store(table_name, id).rows[0] as DictRowType<T> | undefined
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

  // All three store getters construct via `construct_outside_reaction`: a store
  // lazily created INSIDE a consuming `$derived`/effect would have its `$state`
  // swallowed by that reaction's `current_sources` dep-skip, silently freezing
  // the consumer forever (.issues/dict-table-accessor-rows-reactivity.md +
  // repo-root reactivity-poc/).
  #get_table_store(table_name: string): DictTableStore<Record<string, unknown>> {
    let store = this.#table_stores.get(table_name)
    if (!store) {
      store = construct_outside_reaction(() => new DictTableStore({
        connection: this.#connection,
        notifier: this.#notifier,
        table_name,
        query: `SELECT * FROM "${table_name}"`,
        params: [],
        on_save: this.#save_cb(table_name),
        on_delete: this.#delete_cb(table_name),
        on_reset: this.#reset_cb(table_name),
      }))
      this.#table_stores.set(table_name, store)
    }
    return store
  }

  #get_row_store(table_name: string, id: string): DictTableStore<Record<string, unknown>> {
    const key = `${table_name}:${id}`
    let store = this.#row_stores.get(key)
    if (!store) {
      store = construct_outside_reaction(() => new DictTableStore({
        connection: this.#connection,
        notifier: this.#notifier,
        table_name,
        query: `SELECT * FROM "${table_name}" WHERE id = ?`,
        params: [id],
        on_save: this.#save_cb(table_name),
        on_delete: this.#delete_cb(table_name),
        on_reset: this.#reset_cb(table_name),
      }))
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
      store = construct_outside_reaction(() => new DictTableStore({
        connection: this.#connection,
        notifier: this.#notifier,
        table_name,
        query: sql,
        params,
        on_save: this.#save_cb(table_name),
        on_delete: this.#delete_cb(table_name),
        on_reset: this.#reset_cb(table_name),
      }))
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

  /**
   * Run a worker-side atomic write op, injecting the current editor for audit
   * stamping. The worker broadcasts `tables_changed`/`rows_deleted` to every
   * tab (INCLUDING this one — a worker's BroadcastChannel post reaches its own
   * tab's main thread, and lands before the RPC response on the same ordered
   * channel). Table notifies also run locally off the outcome for snappy store
   * refreshes; delete events do NOT — the broadcast alone delivers them, so
   * each delete reaches `subscribe_deletes` exactly once per tab.
   */
  async #dict_write<T>(op: DictWriteOp, args: Record<string, unknown>): Promise<DictWriteOutcome<T>> {
    const outcome = await this.#connection.dict_write<T>(op, $state.snapshot({ ...args, user_id: this.#user_id }))
    for (const table of outcome.affected_tables) this.#notifier.notify(table)
    return outcome
  }

  get writes(): DictWrites {
    if (!this.#writes) {
      const write = async <T>(op: DictWriteOp, args: Record<string, unknown>): Promise<T> => {
        const { result } = await this.#dict_write<T>(op, args)
        return result
      }
      // The PRIMARY row's id is generated HERE (client-side), not in the
      // worker: if a leader applies an op and dies before responding, the
      // transport re-sends it to the NEW leader — a stamped id makes the
      // re-application collide on the PK and fail loudly instead of a fresh
      // worker-side id silently creating a duplicate. (Caller-provided ids
      // win via spread order; link/unlink are naturally idempotent.)
      this.#writes = {
        insert_entry: args => write('insert_entry', { entry_id: crypto.randomUUID(), ...args }),
        insert_sentence: args => write('insert_sentence', { ...args, sentence: { id: crypto.randomUUID(), ...args.sentence } }),
        insert_sentences: args => write('insert_sentences', { rows: args.rows.map(row => ({ id: crypto.randomUUID(), ...row })) }),
        update_sentence: args => write('update_sentence', args),
        analyze_sentences: args => write('analyze_sentences', args),
        set_token_link: args => write('set_token_link', args),
        create_entry_from_token: args => write('create_entry_from_token', { entry_id: crypto.randomUUID(), ...args }),
        ignore_form: args => write('ignore_form', args),
        insert_text: args => write('insert_text', { text_id: crypto.randomUUID(), ...args }),
        insert_audio: args => write('insert_audio', { ...args, audio: { id: crypto.randomUUID(), ...args.audio } }),
        insert_photo: args => write('insert_photo', { ...args, photo: { id: crypto.randomUUID(), ...args.photo } }),
        insert_video: args => write('insert_video', { ...args, video: { id: crypto.randomUUID(), ...args.video } }),
        link_junction: args => write('link_junction', args),
        unlink_junction: args => write('unlink_junction', args),
      }
    }
    return this.#writes
  }

  #save_cb(table: string) {
    return async (row: Record<string, unknown>) => {
      if (!row.id) {
        log_warning({ message: 'DictLiveDb save: row missing id', context: { table } })
        return
      }
      try {
        const { wrote } = await save_changed_dict_columns({
          connection: this.#connection,
          table,
          row,
          is_syncable: is_dict_syncable(table),
          user_id: this.#user_id,
        })
        if (wrote)
          this.#notifier.notify(table)
      } catch (err) {
        console.error('DictLiveDb save error:', err)
        throw err
      }
    }
  }

  // Hard-delete via the `deletes` tombstone (see `#delete`).
  #delete_cb(table: string) {
    return async (id: string) => {
      try {
        await this.#delete(table as DictTableName, [id])
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

  // Inserts/upserts run worker-side via the atomic `insert_rows`/`upsert_rows`
  // ops (stamping + JSON stringification live in `dict-writes.ts`); a multi-row
  // batch commits or rolls back as ONE transaction. This replaced the old
  // main-thread SAVEPOINT batches, whose SAVEPOINT/RELEASE spanned several
  // `exec` RPCs — a sync apply-transaction could interleave and error.
  async #insert<T extends DictTableName>(table_name: T, set: DictInsertType<T> | DictInsertType<T>[]): Promise<DictRowType<T>[]> {
    const items = Array.isArray(set) ? set : [set]
    if (items.length === 0) return []
    // Stamp ids client-side (content tables all have a synthetic UUID id) so a
    // hand-off re-send collides loudly instead of duplicating — see `writes`.
    const rows = is_dict_syncable(table_name)
      ? items.map(item => (item as { id?: string }).id ? item : { id: crypto.randomUUID(), ...item })
      : items
    const { result } = await this.#dict_write<Record<string, unknown>[]>('insert_rows', { table: table_name, rows })
    return result as DictRowType<T>[]
  }

  async #upsert<T extends DictTableName>(table_name: T, set: DictInsertType<T> | DictInsertType<T>[]): Promise<void> {
    const items = Array.isArray(set) ? set : [set]
    if (items.length === 0) return
    await this.#dict_write('upsert_rows', { table: table_name, rows: items })
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
      if (this.#user_id && !columns.includes('updated_by_user_id')) {
        set_clauses.push('"updated_by_user_id" = ?')
        params.push(this.#user_id)
      }
    }
    params.push(id)
    await this.#connection.execute(
      `UPDATE "${table_name}" SET ${set_clauses.join(', ')} WHERE id = ?`,
      params,
    )
    this.#notifier.notify(table_name)
  }

  // Hard-delete by id. Writing the `deletes` tombstone fires
  // `process_delete_cascade`, which DELETEs the row outright (FK ON DELETE
  // CASCADE then sweeps its children); the tombstone row stays as the durable
  // delete log + sync push queue. We notify ALL syncable tables locally (a
  // cascade can touch any of them) and emit a delete event so the Orama search
  // index drops the removed rows (they vanish from the `updated_at` scan).
  async #delete<T extends DictTableName>(table_name: T, ids: string[]): Promise<void> {
    if (ids.length === 0) return
    for (const id of ids) {
      await this.#connection.execute(
        `INSERT OR IGNORE INTO deletes (table_name, id) VALUES (?, ?)`,
        [table_name, id],
        // `affected_tables` refreshes every tab's table stores; `deleted_rows`
        // makes the worker broadcast `rows_deleted` so every tab's Orama index
        // drops the rows — including THIS tab (a worker BroadcastChannel post
        // reaches its own tab), so no extra local #notify_deletes here.
        { affected_tables: [...DICT_SYNCABLE_TABLES, 'deletes'], deleted_rows: [{ table_name, id }] },
      )
    }
    for (const table of DICT_SYNCABLE_TABLES) this.#notifier.notify(table)
  }
}

type DictTableProperties = { [K in DictTableName]: DictTableAccessor<K> }
export type DictLiveDb = DictLiveDbImpl & DictTableProperties

export function create_dict_live_db(connection: DictConnection, options: { user_id?: string } = {}): DictLiveDb {
  const instance = new DictLiveDbImpl(connection, options)
  return new Proxy(instance, {
    get(target, prop) {
      if (prop in target || typeof prop === 'symbol') {
        // Resolve with `target` as the receiver (NOT the proxy): getters like
        // `writes` read private fields (`this.#writes`), and a private-field
        // brand check throws "Cannot read private member … from an object whose
        // class did not declare it" when `this` is the proxy. Using `target`
        // runs getters on the real instance so private state resolves.
        const value = Reflect.get(target, prop, target)
        return typeof value === 'function' ? value.bind(target) : value
      }
      return target.get_table_accessor(prop as DictTableName)
    },
  }) as DictLiveDb
}
