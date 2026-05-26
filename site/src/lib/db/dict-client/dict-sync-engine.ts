import type {
  DictChangesRequest,
  DictChangesResponse,
  DictSyncableTable,
} from '$lib/db/server/dictionary-sync-helpers'
import type { AuthHeaders } from './rpc-types'
import type { DictSqliteConnection } from './opfs-vfs-loader'
import { ResponseCodes } from '$lib/constants'
import { parse_dict_row, stringify_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { DICT_SYNCABLE_TABLES } from '$lib/db/server/dictionary-sync-helpers'
import { LATEST_DICT_MIGRATION } from './dict-migrations-bundle'

/**
 * Per-dict sync engine. Runs inside the SharedWorker for each open dict.
 *
 * Push + pull in one atomic round-trip, mirroring the server endpoint
 * (`/api/dictionary/[id]/changes`). The shape is a slimmer cousin of the
 * admin.db engine in `lib/db/sync/engine.svelte.ts` — single sector, single
 * watermark in `db_metadata.last_modified_at`.
 *
 * Lifecycle:
 *   - Caller (SharedWorker) constructs one per `dict_id` after the OPFS file
 *     is open and migrations applied.
 *   - `start()` schedules periodic syncs. `stop()` cancels them on close.
 *   - `sync_once()` is the explicit "right now" call used after every write
 *     and on `sync_now` RPC.
 *
 * Error sentinels surface as throws — the SharedWorker translates them into
 * either a broadcast (`schema_outdated`, `snapshot_expired`) or an
 * `ErrorResponse` on the originating port.
 */

export const DICT_SYNC_INTERVAL_MS = 30 * 1000

export interface SyncEngineOptions {
  dict_id: string
  connection: DictSqliteConnection
  has_editor_role: boolean
  /** Resolves the latest auth context (so token refresh propagates here). */
  get_auth: () => AuthHeaders
  /** Fires when one or more tables changed locally (post-pull). */
  on_tables_changed?: (tables: Set<string>) => void
  /** Fires before/after a sync attempt. */
  on_status?: (status: { is_syncing: boolean, last_error: string | null, last_sync_at: string | null }) => void
}

export class DictSyncEngine {
  #dict_id: string
  #connection: DictSqliteConnection
  #has_editor_role: boolean
  #get_auth: () => AuthHeaders
  #on_tables_changed?: (tables: Set<string>) => void
  #on_status?: (status: { is_syncing: boolean, last_error: string | null, last_sync_at: string | null }) => void

  #timer: ReturnType<typeof setInterval> | null = null
  #in_flight = false
  #last_error: string | null = null
  #last_sync_at: string | null = null
  #stopped = false

  constructor(options: SyncEngineOptions) {
    this.#dict_id = options.dict_id
    this.#connection = options.connection
    this.#has_editor_role = options.has_editor_role
    this.#get_auth = options.get_auth
    this.#on_tables_changed = options.on_tables_changed
    this.#on_status = options.on_status
  }

  start() {
    if (this.#timer || this.#stopped)
      return
    this.#timer = setInterval(() => { void this.sync_if_needed() }, DICT_SYNC_INTERVAL_MS)
  }

  stop() {
    this.#stopped = true
    if (this.#timer) {
      clearInterval(this.#timer)
      this.#timer = null
    }
  }

  set_role(has_editor_role: boolean) {
    this.#has_editor_role = has_editor_role
  }

  /** Returns true iff there are pending dirty rows or local tombstones. */
  async has_pending(): Promise<boolean> {
    if (!this.#has_editor_role)
      return false
    for (const table of DICT_SYNCABLE_TABLES) {
      const rows = await this.#connection.query<{ c: number }>(`SELECT COUNT(*) AS c FROM "${table}" WHERE dirty = 1`)
      if ((rows[0]?.c ?? 0) > 0)
        return true
    }
    const deletes = await this.#connection.query<{ c: number }>(`SELECT COUNT(*) AS c FROM deletes`)
    return (deletes[0]?.c ?? 0) > 0
  }

  async sync_if_needed(): Promise<void> {
    if (this.#in_flight || this.#stopped)
      return
    await this.sync_once().catch((err) => {
      console.warn(`[dict-sync] ${this.#dict_id} sync failed:`, err)
    })
  }

  async sync_once(): Promise<DictChangesResponse | null> {
    if (this.#in_flight)
      return null
    this.#in_flight = true
    this.#on_status?.({ is_syncing: true, last_error: this.#last_error, last_sync_at: this.#last_sync_at })

    try {
      const request = await this.#build_request()
      const response = await this.#post(request)
      await this.#apply_response(response)
      this.#last_error = null
      this.#last_sync_at = new Date().toISOString()
      return response
    } catch (err) {
      this.#last_error = (err as Error).message
      throw err
    } finally {
      this.#in_flight = false
      this.#on_status?.({ is_syncing: false, last_error: this.#last_error, last_sync_at: this.#last_sync_at })
    }
  }

  async #build_request(): Promise<DictChangesRequest> {
    const synced_up_to = await this.#read_metadata('last_modified_at')

    const dirty_rows: DictChangesRequest['dirty_rows'] = {}
    const deletes: DictChangesRequest['deletes'] = []

    if (this.#has_editor_role) {
      for (const table of DICT_SYNCABLE_TABLES) {
        const rows = await this.#connection.query<Record<string, unknown>>(`SELECT * FROM "${table}" WHERE dirty = 1`)
        if (rows.length) {
          for (const row of rows) {
            parse_dict_row(table, row)
            delete row.dirty
          }
          dirty_rows[table] = rows
        }
      }
      const tombstones = await this.#connection.query<{ table_name: string, id: string }>(`SELECT table_name, id FROM deletes`)
      deletes.push(...tombstones)
    }

    return {
      synced_up_to,
      dirty_rows,
      deletes,
      latest_dict_migration: LATEST_DICT_MIGRATION,
    }
  }

  async #post(request: DictChangesRequest): Promise<DictChangesResponse> {
    const auth = this.#get_auth()
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (auth.bearer)
      headers.Authorization = `Bearer ${auth.bearer}`

    // Browser flow: the `session` cookie auto-attaches to same-origin fetch
    // from the SharedWorker. `credentials: 'include'` is belt-and-braces.
    const response = await fetch(`/api/dictionary/${this.#dict_id}/changes`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      const message = detail || `HTTP ${response.status}`
      const error = new Error(message) as Error & { status: number, code?: string }
      error.status = response.status
      // Body usually `{ "message": "schema_outdated" }` since SvelteKit's
      // `error()` helper wraps the string in `body.message`. Best-effort
      // parse to surface the sentinel string verbatim.
      try {
        const body = JSON.parse(detail) as { message?: string }
        if (body.message) error.code = body.message
      } catch { /* not JSON */ }
      // Map status → conventional code if body wasn't parseable.
      if (!error.code) {
        if (response.status === ResponseCodes.CONFLICT) error.code = 'schema_outdated'
        else if (response.status === ResponseCodes.SERVICE_UNAVAILABLE) error.code = 'server_outdated'
        else if (response.status === ResponseCodes.GONE) error.code = 'snapshot_expired'
        else if (response.status === ResponseCodes.UNAUTHORIZED) error.code = 'unauthorized'
        else if (response.status === ResponseCodes.FORBIDDEN) error.code = 'role_revoked'
      }
      throw error
    }
    return await response.json() as DictChangesResponse
  }

  async #apply_response(response: DictChangesResponse): Promise<void> {
    const affected = new Set<string>()

    await this.#connection.execute('PRAGMA defer_foreign_keys = ON')
    await this.#connection.execute('BEGIN')
    try {
      for (const table of DICT_SYNCABLE_TABLES) {
        const rows = response.changes[table]
        if (!rows?.length)
          continue
        for (const row of rows) {
          await this.#upsert_row({ table, row })
        }
        affected.add(table)
      }

      for (const { table_name, id } of response.deletes) {
        // Local row may be dirty (we pushed it this round). If so, skip the
        // delete — server already accepted our newer write.
        const local = await this.#connection.query<{ dirty: number | null }>(
          `SELECT dirty FROM "${table_name}" WHERE id = ?`,
          [id],
        )
        const is_dirty = local.length > 0 && local[0].dirty === 1
        if (!is_dirty) {
          await this.#connection.execute(`DELETE FROM "${table_name}" WHERE id = ?`, [id])
          affected.add(table_name)
        }
      }

      // Clear dirty flags on rows we just successfully pushed.
      if (this.#has_editor_role) {
        for (const table of DICT_SYNCABLE_TABLES) {
          await this.#connection.execute(`UPDATE "${table}" SET dirty = NULL WHERE dirty = 1`)
        }
        // Tombstones successfully pushed (server returned them in deletes echo
        // or they're rows we own anyway): drain the local table.
        await this.#connection.execute(`DELETE FROM deletes`)
      }

      // Persist the new watermark in db_metadata for next sync.
      await this.#connection.execute(
        `INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_modified_at', ?)`,
        [response.new_synced_up_to],
      )

      await this.#connection.execute('COMMIT')
    } catch (err) {
      await this.#connection.execute('ROLLBACK')
      throw err
    }

    if (affected.size > 0)
      this.#on_tables_changed?.(affected)
  }

  async #upsert_row({ table, row }: { table: DictSyncableTable, row: Record<string, unknown> }) {
    const row_obj = { ...row }
    delete row_obj.dirty
    stringify_dict_row(table, row_obj)
    const columns = Object.keys(row_obj)
    const placeholders = columns.map(() => '?').join(', ')
    const update_set = columns
      .filter(c => c !== 'id')
      .map(c => `"${c}" = excluded."${c}"`)
      .join(', ')
    const values = columns.map(c => row_obj[c] as string | number | null)
    await this.#connection.execute(
      `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')})
       VALUES (${placeholders})
       ON CONFLICT(id) DO UPDATE SET ${update_set}`,
      values,
    )
  }

  async #read_metadata(key: string): Promise<string | null> {
    const rows = await this.#connection.query<{ value: string }>(
      `SELECT value FROM db_metadata WHERE key = ?`,
      [key],
    )
    return rows[0]?.value ?? null
  }
}
