import type { SqliteConnection } from '../connection'
import type { TableChangeNotifier } from './notifier'
import type { Saveable, TableName } from './types'
import { JSON_COLUMNS, parse_row } from '$lib/db/schemas/json-columns'
import { tick } from 'svelte'
import { reconcile_rows } from './reconcile-rows'

export type SaveCallback = (row: Record<string, unknown>) => Promise<void>
export type DeleteCallback = (id: string) => Promise<void>
export type ResetCallback = (row: Record<string, unknown>) => Promise<void>

export interface TableStoreConfig {
  connection: SqliteConnection
  notifier: TableChangeNotifier
  table_name: string
  query: string
  params: unknown[]
  primary_keys?: string[]
  log?: boolean
  on_save: SaveCallback
  on_delete: DeleteCallback
  on_reset: ResetCallback
}

/**
 * TableStore manages reactive state for a database table or query.
 * Uses write-triggered re-query via TableChangeNotifier.
 */
export class TableStore<T extends Record<string, unknown>> {
  #rows = $state<T[]>([])
  #objects = $state<Record<string, T>>({})

  #subscribers = 0
  #unsubscribe_notifier: (() => void) | null = null
  #started = false
  #stop_timeout: ReturnType<typeof setTimeout> | null = null

  #loading = $state(true)

  #connection: SqliteConnection
  #notifier: TableChangeNotifier
  #table_name: string
  #query: string
  #params: unknown[]
  #primary_keys: string[]
  #log: boolean
  #on_save: SaveCallback
  #on_delete: DeleteCallback
  #on_reset: ResetCallback

  constructor(config: TableStoreConfig) {
    this.#connection = config.connection
    this.#notifier = config.notifier
    this.#table_name = config.table_name
    this.#query = config.query
    this.#params = config.params
    this.#primary_keys = config.primary_keys ?? ['id']
    this.#log = config.log ?? false
    this.#on_save = config.on_save
    this.#on_delete = config.on_delete
    this.#on_reset = config.on_reset
  }

  get rows(): T[] {
    this.#bump_subscribers()
    return this.#rows
  }

  get loading(): boolean {
    this.#bump_subscribers()
    return this.#loading
  }

  get objects(): Record<string, T> {
    this.#bump_subscribers()
    return this.#objects
  }

  #bump_subscribers() {
    if ($effect.tracking()) {
      $effect(() => {
        if (this.#subscribers === 0 && !this.#started) {
          this.#start()
        }
        this.#subscribers++
        return () => {
          tick().then(() => {
            this.#subscribers--
            if (this.#subscribers === 0) {
              this.#schedule_stop()
            }
          })
        }
      })
    }
  }

  async #start() {
    if (this.#stop_timeout) {
      clearTimeout(this.#stop_timeout)
      this.#stop_timeout = null
    }
    this.#started = true
    this.#loading = true

    if (this.#log) {
      console.log('[LiveDb] Subscribing to query:', this.#query, this.#params)
    }

    try {
      await this.#run_query()
      this.#loading = false
      this.#unsubscribe_notifier = this.#notifier.subscribe(this.#table_name, () => {
        this.#run_query()
      })
    } catch (error) {
      console.error(this.#query, this.#params, this.#primary_keys)
      console.error('LiveDb subscription error:', error)
      this.#loading = false
      this.#started = false
    }
  }

  async #run_query() {
    const fresh_rows = await this.#connection.query<T>(this.#query, this.#params)
    if (JSON_COLUMNS[this.#table_name as TableName]) {
      for (const row of fresh_rows)
        parse_row(this.#table_name as TableName, row as Record<string, unknown>)
    }
    this.#diff_and_apply(fresh_rows)
  }

  #row_key(row: Record<string, unknown>): string {
    return this.#primary_keys.map(k => String(row[k])).join('::')
  }

  #diff_and_apply(fresh_rows: T[]) {
    reconcile_rows<T>({
      rows: this.#rows,
      objects: this.#objects,
      fresh_rows,
      row_key: row => this.#row_key(row),
      on_row_added: row => this.#attach_methods(row as Record<string, unknown> & Saveable),
    })

    for (const row of this.#rows) {
      const key = this.#row_key(row)
      if (this.#objects[key] && !(this.#objects[key] as Record<string, unknown> & Saveable)._save) {
        this.#attach_methods(this.#objects[key] as Record<string, unknown> & Saveable)
      }
    }
  }

  #schedule_stop() {
    if (this.#stop_timeout)
      return
    this.#stop_timeout = setTimeout(() => {
      this.#stop_timeout = null
      if (this.#subscribers === 0) {
        this.#stop()
      }
    }, 5000)
  }

  #stop() {
    if (this.#log)
      console.log('[LiveDb] Unsubscribing from query:', this.#query, this.#params)

    if (this.#unsubscribe_notifier) {
      this.#unsubscribe_notifier()
      this.#unsubscribe_notifier = null
    }
    this.#started = false
  }

  #attach_methods(row: Record<string, unknown> & Saveable) {
    const on_save = this.#on_save
    const on_delete = this.#on_delete
    const on_reset = this.#on_reset
    const primary_keys = this.#primary_keys

    row._save = async () => {
      await on_save(row)
    }

    row._delete = async () => {
      const row_id = primary_keys.length === 1 ? row[primary_keys[0]] as string : primary_keys.map(k => row[k]).join('::')
      await on_delete(row_id)
    }

    row._reset = async () => {
      await on_reset(row)
    }
  }
}
