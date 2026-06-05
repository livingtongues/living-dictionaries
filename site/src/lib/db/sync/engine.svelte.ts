import type { SqliteConnection } from '$lib/db/client/connection'
import type { SyncableTableName, SyncLogEntry, SyncRequest, SyncResponse, SyncResult, SyncRow } from './types'
import { api_admin_sync } from '$api/admin-sync/_call.js'
import { ResponseCodes } from '$lib/constants'
import { latest_client_migration_name } from '$lib/db/client/db'
import { JSON_COLUMNS, parse_row, stringify_row } from '$lib/db/schemas/json-columns'
import { online } from 'svelte/reactivity/window'
import { ClientBehindError, ServerBehindError } from './errors'
import { SyncHistory } from './history.svelte.js'
import { record_last_visit_ping, should_ping_last_visit } from './last-visit-ping'
import { is_readonly_table, SYNCABLE_TABLE_NAMES } from './types'

export type SyncPostFn = (body: SyncRequest) => Promise<{ data: SyncResponse | null, error: { status: number, message: string } | null }>

export type NotifiableTable = SyncableTableName | 'deletes'

/**
 * Delay before auto-flushing dirty rows. Throttle (not debounce): first
 * `mark_dirty` arms the timer; subsequent dirties ride along without
 * resetting it.
 */
export const AUTO_FLUSH_DELAY_MS = 30_000

/**
 * Sync engine for LD's admin.db ↔ shared.db link.
 *
 * Simpler than house's engine: ONE sector, ONE watermark
 * (`db_metadata.synced_up_to`), no per-sector loop or per-sector dirty
 * counters. All admin-visible tables ride together in a single HTTP roundtrip.
 */
export class Sync {
  is_syncing = $state(false)
  last_error: string | null = $state(null)
  last_sync_result: SyncResult | null = $state(null)
  log_entries: SyncLogEntry[] = $state([])
  history = new SyncHistory()
  total_dirty = $state(0)
  watermark = $state<string | null>(null)
  blocked_by_client_behind = $state(false)
  #last_sync_finished_at = 0
  // eslint-disable-next-line no-unused-private-class-members
  #auto_flush_timer: ReturnType<typeof setTimeout> | null = null

  #connection: SqliteConnection
  #user_id: string
  #post_fn: SyncPostFn
  #on_tables_changed?: (tables: Set<NotifiableTable>) => void
  #on_client_behind?: () => void

  constructor({ connection, user_id, post_fn, on_tables_changed, on_client_behind }: {
    connection: SqliteConnection
    user_id: string
    post_fn?: SyncPostFn
    on_tables_changed?: (tables: Set<NotifiableTable>) => void
    on_client_behind?: () => void
  }) {
    this.#connection = connection
    this.#user_id = user_id
    this.#post_fn = post_fn ?? api_admin_sync
    this.#on_tables_changed = on_tables_changed
    this.#on_client_behind = on_client_behind
    this.#load_watermark()
  }

  async #load_watermark() {
    const rows = await this.#connection.query<{ value: string }>(
      'SELECT value FROM db_metadata WHERE key = ?',
      ['synced_up_to'],
    )
    if (rows.length > 0)
      this.watermark = rows[0].value
  }

  mark_dirty(table_name: SyncableTableName) {
    if (is_readonly_table(table_name))
      return
    this.total_dirty++
    this.#schedule_auto_flush()
  }

  #schedule_auto_flush() {
    if (this.#auto_flush_timer)
      return
    this.#auto_flush_timer = setTimeout(() => {
      this.#auto_flush_timer = null
      void this.sync_if_needed()
    }, AUTO_FLUSH_DELAY_MS)
  }

  #cancel_auto_flush() {
    if (this.#auto_flush_timer) {
      clearTimeout(this.#auto_flush_timer)
      this.#auto_flush_timer = null
    }
  }

  async sync() {
    return await this.#run()
  }

  async sync_if_needed() {
    if (this.is_syncing)
      return
    if (this.blocked_by_client_behind)
      return
    if (online.current === false)
      return
    if (this.total_dirty === 0)
      return
    await this.#run()
  }

  async sync_on_resume() {
    if (this.is_syncing)
      return
    if (this.blocked_by_client_behind)
      return
    if (online.current === false)
      return
    if (Date.now() - this.#last_sync_finished_at < 5 * 60 * 1000)
      return
    await this.#run()
  }

  async #run() {
    if (this.is_syncing)
      throw new Error('Sync already in progress')
    if (online.current === false) {
      this.log_entries = []
      this.#log({ level: 'warn', phase: 'sync', message: 'Sync skipped — offline' })
      return
    }

    this.#cancel_auto_flush()
    this.is_syncing = true
    this.last_error = null
    this.log_entries = []
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const started_at = new Date()
    const result: SyncResult = {
      success: true,
      items_uploaded: 0,
      items_downloaded: 0,
      deletes_pushed: 0,
      deletes_pulled: 0,
      error: null,
      duration_ms: 0,
      last_sync_time: null,
    }

    this.#log({ level: 'info', phase: 'sync', message: 'Starting sync' })

    const needs_visit_ping = should_ping_last_visit({ user_id: this.#user_id })

    try {
      await this.#sync_once({ result, update_last_visit: needs_visit_ping })
      if (needs_visit_ping)
        record_last_visit_ping({ user_id: this.#user_id })
      this.total_dirty = 0
      // eslint-disable-next-line svelte/prefer-svelte-reactivity
      result.last_sync_time = new Date().toISOString()
      this.#log({ level: 'success', phase: 'sync', message: `Sync complete in ${((Date.now() - started_at.getTime()) / 1000).toFixed(1)}s — ${result.items_uploaded}↑ ${result.items_downloaded}↓ ${result.deletes_pushed}⌦ ${result.deletes_pulled}⌫` })
    } catch (error) {
      result.success = false
      result.error = (error as Error).message
      this.last_error = result.error
      if (error instanceof ClientBehindError) {
        this.blocked_by_client_behind = true
        this.#log({ level: 'error', phase: 'sync', message: `Sync blocked — app bundle is out of date. ${(error as Error).message}` })
        this.#on_client_behind?.()
      } else if (error instanceof ServerBehindError) {
        this.#log({ level: 'warn', phase: 'sync', message: `Sync deferred — server is behind this client bundle. Will retry. ${(error as Error).message}` })
      } else {
        this.#log({ level: 'error', phase: 'sync', message: `Sync failed: ${result.error}` })
      }
    } finally {
      result.duration_ms = Date.now() - started_at.getTime()
      this.last_sync_result = result
      this.is_syncing = false
      this.#last_sync_finished_at = Date.now()
      this.history.save_report({ result, log_entries: this.log_entries, started_at })
    }

    return result
  }

  #log({ level, phase, table, message, detail, row_count }: Omit<SyncLogEntry, 'timestamp'>) {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    this.log_entries = [...this.log_entries, { timestamp: new Date(), level, phase, table, message, detail, row_count }]
  }

  async #sync_once({ result, update_last_visit }: { result: SyncResult, update_last_visit: boolean }) {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const affected_tables = new Set<NotifiableTable>()

    const dirty_rows: { [K in SyncableTableName]?: SyncRow<K>[] } = {}
    for (const table_name of SYNCABLE_TABLE_NAMES) {
      if (is_readonly_table(table_name))
        continue
      const rows = await this.#connection.query<Record<string, unknown>>(
        `SELECT * FROM "${table_name}" WHERE dirty = 1`,
      )
      if (JSON_COLUMNS[table_name]) {
        for (const row of rows)
          parse_row(table_name, row)
      }
      if (rows.length > 0) {
        dirty_rows[table_name] = rows as never
        result.items_uploaded += rows.length
        this.#log({ level: 'info', phase: 'upload', table: table_name, message: 'Uploading', row_count: rows.length })
      }
    }

    const deletes = await this.#connection.query<{ table_name: string, id: string }>(
      'SELECT table_name, id FROM deletes',
    )
    if (deletes.length > 0) {
      result.deletes_pushed += deletes.length
      this.#log({ level: 'info', phase: 'upload', message: 'Pushing deletes', row_count: deletes.length })
    }

    const synced_up_to = await this.#get_watermark()

    const request: SyncRequest = {
      synced_up_to,
      dirty_rows,
      deletes,
      latest_migration: latest_client_migration_name,
      update_last_visit,
    }

    const fetch_start = Date.now()
    const response = await this.#post_sync(request)
    this.#log({ level: 'info', phase: 'fetch', message: `Server responded in ${Date.now() - fetch_start}ms` })

    await this.#connection.execute('PRAGMA defer_foreign_keys = ON')
    await this.#connection.execute('BEGIN')

    try {
      for (const table_name of SYNCABLE_TABLE_NAMES) {
        const changes = response.changes[table_name]
        if (!changes?.length)
          continue
        for (const row of changes) {
          if (is_readonly_table(table_name))
            delete (row as Record<string, unknown>).dirty
          else
            (row as { dirty: number | null }).dirty = null
          await this.#upsert_row(table_name, row)
        }
        affected_tables.add(table_name)
        result.items_downloaded += changes.length
        this.#log({ level: 'info', phase: 'download', table: table_name, message: 'Downloaded', row_count: changes.length })
      }

      let deletes_pulled = 0
      let deletes_skipped = 0
      for (const { table_name, id } of response.deletes) {
        let is_dirty = false
        if (!is_readonly_table(table_name as SyncableTableName)) {
          const local = await this.#connection.query<{ dirty: number | null }>(
            `SELECT dirty FROM "${table_name}" WHERE id = ?`,
            [id],
          )
          is_dirty = local.length > 0 && local[0].dirty === 1
        }
        if (!is_dirty) {
          await this.#connection.execute(`DELETE FROM "${table_name}" WHERE id = ?`, [id])
          affected_tables.add(table_name as NotifiableTable)
          result.deletes_pulled++
          deletes_pulled++
        } else {
          deletes_skipped++
        }
      }
      if (deletes_pulled > 0)
        this.#log({ level: 'info', phase: 'download', message: 'Pulled deletes', row_count: deletes_pulled })
      if (deletes_skipped > 0)
        this.#log({ level: 'warn', phase: 'download', message: 'Skipped stale deletes (dirty locally)', row_count: deletes_skipped })

      // Clear dirty on uploaded rows.
      for (const table_name of SYNCABLE_TABLE_NAMES) {
        if (is_readonly_table(table_name))
          continue
        const rows = dirty_rows[table_name]
        if (!rows?.length)
          continue
        for (const row of rows as { id: string }[]) {
          await this.#connection.execute(
            `UPDATE "${table_name}" SET dirty = NULL WHERE id = ?`,
            [row.id],
          )
        }
      }

      if (response.new_synced_up_to) {
        await this.#connection.execute(
          'INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)',
          ['synced_up_to', response.new_synced_up_to],
        )
        this.watermark = response.new_synced_up_to
      }

      await this.#connection.execute('DELETE FROM deletes')
      await this.#connection.execute('COMMIT')
    } catch (error) {
      await this.#connection.execute('ROLLBACK')
      throw error
    }

    if (affected_tables.size > 0)
      this.#on_tables_changed?.(affected_tables)
  }

  async #get_watermark(): Promise<string | null> {
    const rows = await this.#connection.query<{ value: string }>(
      'SELECT value FROM db_metadata WHERE key = ?',
      ['synced_up_to'],
    )
    return rows.length > 0 ? rows[0].value : null
  }

  async #post_sync(request: SyncRequest): Promise<SyncResponse> {
    const { data, error } = await this.#post_fn(request)
    if (error) {
      if (error.status === ResponseCodes.CONFLICT)
        throw new ClientBehindError(error.message || 'Client bundle is out of date')
      if (error.status === ResponseCodes.SERVICE_UNAVAILABLE)
        throw new ServerBehindError(error.message || 'Server bundle is behind the client')
      throw new Error(error.message || `Sync failed: ${error.status}`)
    }
    return data!
  }

  async #upsert_row(table_name: string, row: object) {
    const row_obj = { ...(row as Record<string, unknown>) }
    if (JSON_COLUMNS[table_name])
      stringify_row(table_name, row_obj)

    const columns = Object.keys(row_obj)
    const placeholders = columns.map(() => '?').join(', ')
    const id_column = table_name === 'email_aliases' ? 'email' : 'id'
    const update_set = columns
      .filter(c => c !== id_column)
      .map(c => `"${c}" = excluded."${c}"`)
      .join(', ')

    const values = columns.map(c => row_obj[c])

    await this.#connection.execute(
      `INSERT INTO "${table_name}" (${columns.map(c => `"${c}"`).join(', ')})
       VALUES (${placeholders})
       ON CONFLICT(${id_column}) DO UPDATE SET ${update_set}`,
      values,
    )
  }
}
