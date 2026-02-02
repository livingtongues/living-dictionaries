import type { LiveChanges, PGliteWithLive } from '@electric-sql/pglite/live'
import type { Change, ChangeInsert, Saveable } from './types'
import { tick } from 'svelte'
import { composite_changes, type CompositeChangesResult } from './composite-changes'

// Callback types for row operations
export type SaveCallback = (row: Record<string, unknown>) => Promise<void>
export type DeleteCallback = (composite_key: string) => Promise<void>
export type ResetCallback = (row: Record<string, unknown>) => Promise<void>

export interface TableStoreConfig {
  pg: PGliteWithLive
  query: string
  params: unknown[]
  primary_keys?: string[]
  log?: boolean
  on_save?: SaveCallback
  on_delete?: DeleteCallback
  on_reset?: ResetCallback
}

/**
 * TableStore manages reactive state for a database table or query.
 * Uses Svelte 5 $state for fine-grained reactivity.
 */
export class TableStore<T extends Record<string, unknown>> {
  // The reactive array - mutated in place, never replaced
  #rows = $state<T[]>([])

  // Object keyed by primary key for O(1) lookups with reactivity
  #objects = $state<Record<string, T>>({})

  // Subscription management
  #subscribers = 0
  #unsubscribe: (() => Promise<void>) | null = null
  #started = false

  // Loading state
  #loading = $state(true)

  // Configuration
  #pg: PGliteWithLive
  #query: string
  #params: unknown[]
  #primary_keys: string[]
  #single_primary_key: string | null
  #log: boolean
  #on_save?: SaveCallback
  #on_delete?: DeleteCallback
  #on_reset?: ResetCallback

  constructor(config: TableStoreConfig) {
    this.#pg = config.pg
    this.#query = config.query
    this.#params = config.params
    this.#primary_keys = config.primary_keys ?? ['id']
    this.#single_primary_key = this.#primary_keys.length === 1 ? this.#primary_keys[0] : null
    this.#log = config.log ?? false
    this.#on_save = config.on_save
    this.#on_delete = config.on_delete
    this.#on_reset = config.on_reset
  }

  /**
   * Build a composite key string from a row's primary key values
   */
  #get_row_key(row: Record<string, unknown>): string {
    if (this.#single_primary_key) {
      return row[this.#single_primary_key] as string
    }
    return this.#primary_keys.map(k => row[k]).join('|')
  }

  /**
   * Access rows - triggers subscription via $effect.tracking()
   */
  get rows(): T[] {
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
              this.#stop()
            }
          })
        }
      })
    }
    return this.#rows
  }

  /**
   * Loading state
   */
  get loading(): boolean {
    return this.#loading
  }

  /**
   * Get all rows as an object keyed by primary key
   */
  get objects(): Record<string, T> {
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
              this.#stop()
            }
          })
        }
      })
    }
    return this.#objects
  }

  /**
   * Get a row by its primary key
   */
  get_by_id(id: string): T | undefined {
    return this.#objects[id]
  }

  /**
   * Start the live query subscription
   */
  async #start() {
    this.#started = true
    this.#loading = true

    if (this.#log) {
      console.log('[LivePgLite] Subscribing to query:', this.#query, this.#params)
    }

    try {
      let result: LiveChanges<T> | CompositeChangesResult<T> = null
      const use_composite = this.#primary_keys.length > 1
      if (use_composite) {
        result = await composite_changes<T>(this.#pg, {
          query: this.#query,
          params: this.#params,
          keys: this.#primary_keys,
        })
      } else {
        result = await this.#pg.live.changes<T>(
          this.#query,
          this.#params,
          this.#primary_keys[0],
        )
      }

      // Clear existing data before applying initial changes to avoid duplicates on resubscription
      this.#rows.length = 0
      for (const key of Object.keys(this.#objects)) {
        delete this.#objects[key]
      }

      // Apply initial changes
      for (const change of result.initialChanges) {
        this.#apply_change(change as Change<T>)
      }

      // Subscribe to ongoing changes
      result.subscribe((changes) => {
        for (const change of changes) {
          this.#apply_change(change as Change<T>)
        }
      })

      this.#unsubscribe = result.unsubscribe
      this.#loading = false
    } catch (error) {
      console.error(this.#query, this.#params, this.#primary_keys)
      console.error('LivePgLite subscription error:', error)
      this.#show_toast(`Database error: ${(error as Error).message}`)
      this.#loading = false
      this.#started = false
    }
  }

  /**
   * Stop the live query subscription
   */
  async #stop() {
    if (this.#log) {
      console.log('[LivePgLite] Unsubscribing from query:', this.#query, this.#params)
    }

    if (this.#unsubscribe) {
      await this.#unsubscribe()
      this.#unsubscribe = null
    }
    this.#started = false
    // Keep data in memory for next subscriber
  }

  /**
   * Apply a change from pg.live.changes()
   * Critical: mutates array in place for Svelte 5 fine-grained reactivity
   */
  #apply_change(change: Change<T>) {
    const row_key = this.#get_row_key(change as unknown as Record<string, unknown>)

    switch (change.__op__) {
      case 'RESET':
        // Clear everything
        this.#rows.length = 0
        for (const key of Object.keys(this.#objects)) {
          delete this.#objects[key]
        }
        break

      case 'INSERT': {
        // Remove internal fields before storing
        const row = this.#clean_row(change)
        this.#rows.push(row)
        this.#objects[row_key] = row
        // Attach methods after pushing so they capture the $state proxy
        const proxyRow = this.#rows[this.#rows.length - 1] as Record<string, unknown> & Saveable
        this.#attach_methods(proxyRow)
        break
      }

      case 'DELETE': {
        const index = this.#rows.findIndex(r => this.#get_row_key(r as unknown as Record<string, unknown>) === row_key)
        if (index !== -1) {
          this.#rows.splice(index, 1)
        }
        delete this.#objects[row_key]
        break
      }

      case 'UPDATE': {
        const index = this.#rows.findIndex(r => this.#get_row_key(r as unknown as Record<string, unknown>) === row_key)
        if (index !== -1) {
          for (const col of change.__changed_columns__) {
            if (col !== '__after__') {
              (this.#rows[index] as Record<string, unknown>)[col] = change[col]
              ;(this.#objects[row_key] as Record<string, unknown>)[col] = change[col]
            }
          }
        }
        break
      }
    }
  }

  /**
   * Remove PGLite internal fields from a change to get a clean row
   */
  #clean_row(change: ChangeInsert<T>): T {
    const { __op__, __changed_columns__, __after__, ...row } = change
    return row as unknown as T
  }

  /**
   * Attach _save, _delete, _reset methods to a row
   * Must be called after the row is in the $state array so we capture the proxy
   * For read-only tables (no callbacks), methods won't be attached
   */
  #attach_methods(row: Record<string, unknown> & Saveable) {
    const on_save = this.#on_save
    const on_delete = this.#on_delete
    const on_reset = this.#on_reset
    const get_row_key = this.#get_row_key.bind(this)

    if (on_save) {
      row._save = async () => {
        await on_save(row)
      }
    }

    if (on_delete) {
      row._delete = async () => {
        const composite_key = get_row_key(row)
        await on_delete(composite_key)
      }
    }

    if (on_reset) {
      row._reset = async () => {
        await on_reset(row)
      }
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
