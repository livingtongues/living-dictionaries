import type {
  DictChangesRequest,
  DictChangesResponse,
} from '$lib/db/server/dictionary-sync-helpers'
import type { DictSyncableTable } from '$lib/db/dict-syncable-tables'
import type { AuthHeaders } from './worker/instance'
import { ResponseCodes } from '$lib/constants'
import { parse_dict_row, stringify_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { DICT_SYNCABLE_TABLES } from '$lib/db/dict-syncable-tables'
import { classify_sync_failure, is_storage_lost_error, RepeatFailureTracker } from '$lib/db/sync/sync-failure-classify'
import { LATEST_DICT_MIGRATION } from './dict-migrations-bundle'
import { report_dict_stuck_dirty, report_dict_sync_failure } from './report-dict-sync-failure'

/** The slice of the worker's connection the engine needs (reads + writes). */
export interface EngineConnection {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
  execute: (sql: string, params?: unknown[]) => Promise<void>
}

/**
 * Per-dict sync engine. Runs inside the leader dedicated worker for each open
 * dict (one leader per dictionary — see `worker/instance.ts`).
 *
 * Push + pull in one atomic round-trip, mirroring the server endpoint
 * (`/api/dictionary/[id]/changes`). The shape is a slimmer cousin of the
 * admin.db engine in `lib/db/sync/engine.svelte.ts` — single sector, single
 * watermark in `db_metadata.last_modified_at`.
 *
 * Lifecycle:
 *   - The dict instance constructs one per `dict_id` after the OPFS file is
 *     open and migrations applied.
 *   - `start()` schedules periodic syncs. `stop()` cancels them on close.
 *   - `sync_once()` is the explicit "right now" call used after every write
 *     and on `sync_now` RPC.
 *
 * Error sentinels surface as throws — the dict instance translates them into
 * either a broadcast (`schema_outdated`, `snapshot_expired`) or an RPC error
 * for the originating tab.
 */

export const DICT_SYNC_INTERVAL_MS = 30 * 1000
/** Stuck-dirty watchdog cadence — pending writes seen at two consecutive checks ship a warn. */
export const STUCK_DIRTY_CHECK_MS = 5 * 60 * 1000

export interface SyncEngineOptions {
  dict_id: string
  connection: EngineConnection
  has_editor_role: boolean
  /** Resolves the latest auth context (so token refresh propagates here). */
  get_auth: () => AuthHeaders
  /**
   * Op-level mutex shared with the dict instance. Held across the WHOLE
   * apply-transaction (BEGIN..COMMIT) so a main-thread `exec` RPC can never
   * land mid-sync-transaction on the shared connection (SQLite txns are
   * per-connection — an interleaved write would silently enrol and could be
   * rolled back with it). The network round-trip stays OUTSIDE the lock.
   */
  serialize?: <T>(fn: () => Promise<T>) => Promise<T>
  /** Fires when one or more tables changed locally (post-pull). */
  on_tables_changed?: (tables: Set<string>) => void
  /** Fires with the (table, id) of rows hard-deleted by a pull (for the search index). */
  on_rows_deleted?: (deletes: { table_name: string, id: string }[]) => void
  /** Fires before/after a sync attempt. */
  on_status?: (status: { is_syncing: boolean, last_error: string | null, last_sync_at: string | null }) => void
  /**
   * Fires when a sync fails because the underlying storage handle is gone
   * (browser closed the held OPFS sync-access-handle — see
   * `is_storage_lost_error`). The instance reopens the connection in place;
   * without this the 30s interval hot-loops against a dead handle forever.
   */
  on_storage_lost?: () => void
  /**
   * Fires ONCE when a sync fails because this bundle's dict schema is older
   * than the server's (`schema_outdated`/`client_behind`, HTTP 409). This is a
   * permanent-until-reload block — the same 409 recurs on every 30s tick — so
   * the engine latches a blocked flag (see `sync_if_needed`) to stop hammering
   * the server (mirrors the admin engine's `blocked_by_client_behind`). The
   * instance wires this to broadcast `schema_outdated` to every tab so the
   * main-thread recovery reloads onto a fresh bundle. Before this hook the
   * interval path never reached `translate_sync_error`, so a tab that went
   * stale AFTER load retried forever and never broadcast (the client_behind
   * retry-storm — see `.issues/dict-sync-client-behind-storm-2026-07-05.md`).
   */
  on_version_blocked?: () => void
  /**
   * Fires ONCE when the repeat-fatal circuit breaker trips (the same
   * non-transient failure recurred `REPEAT_FAILURE_HALT_THRESHOLD`× in a row —
   * see `RepeatFailureTracker`). The engine latches a blocked flag so the 30s
   * interval stops re-pushing the identical doomed payload; the instance
   * broadcasts `sync_halted` so every tab shows "your changes aren't saving —
   * reload / contact us". Cleared only by building a fresh engine.
   */
  on_repeated_failure?: (info: { message: string, consecutive: number }) => void
  /**
   * Fires ONCE on the 2nd consecutive `fk_constraint` apply failure — the
   * client's local DB is missing a parent row (the FK-wedge class, see
   * .issues/sync-fk-wedge-server-seq-and-self-heal.md), so retrying re-hits the
   * same COMMIT rollback forever. Fires BEFORE the breaker halts at 3 so the
   * instance can SELF-HEAL: flush any pending push, then reset to a fresh
   * snapshot (`rebuild()` in dict-instance).
   */
  on_integrity_wedged?: () => void
}

export class DictSyncEngine {
  #dict_id: string
  #connection: EngineConnection
  #has_editor_role: boolean
  #get_auth: () => AuthHeaders
  #serialize: <T>(fn: () => Promise<T>) => Promise<T>
  #on_tables_changed?: (tables: Set<string>) => void
  #on_rows_deleted?: (deletes: { table_name: string, id: string }[]) => void
  #on_status?: (status: { is_syncing: boolean, last_error: string | null, last_sync_at: string | null }) => void
  #on_storage_lost?: () => void
  #on_version_blocked?: () => void
  #on_repeated_failure?: (info: { message: string, consecutive: number }) => void
  #on_integrity_wedged?: () => void
  #integrity_wedged_fired = false

  #timer: ReturnType<typeof setInterval> | null = null
  #stuck_timer: ReturnType<typeof setInterval> | null = null
  #pending_at_last_check = false
  #in_flight = false
  #last_error: string | null = null
  #last_sync_at: string | null = null
  #stopped = false
  /**
   * Latched true after a `schema_outdated` (client_behind) failure — a
   * permanent-until-reload block. `sync_if_needed` (interval + post-write)
   * no-ops while set, so a stale tab stops retrying every 30s. Cleared only by
   * building a fresh engine (reset / storage-lost reopen construct a new one).
   */
  #version_blocked = false
  /**
   * Latched true when the repeat-fatal circuit breaker trips (see
   * `on_repeated_failure`). Like `#version_blocked`, permanent for this
   * engine's lifetime — reset / storage-lost reopen construct a fresh one.
   */
  #repeated_failure_blocked = false
  #repeat_tracker = new RepeatFailureTracker()

  constructor(options: SyncEngineOptions) {
    this.#dict_id = options.dict_id
    this.#connection = options.connection
    this.#has_editor_role = options.has_editor_role
    this.#get_auth = options.get_auth
    this.#serialize = options.serialize ?? (fn => fn())
    this.#on_tables_changed = options.on_tables_changed
    this.#on_rows_deleted = options.on_rows_deleted
    this.#on_status = options.on_status
    this.#on_storage_lost = options.on_storage_lost
    this.#on_version_blocked = options.on_version_blocked
    this.#on_repeated_failure = options.on_repeated_failure
    this.#on_integrity_wedged = options.on_integrity_wedged
  }

  /** True once a `schema_outdated` block has latched (see `#version_blocked`). */
  get is_version_blocked(): boolean {
    return this.#version_blocked
  }

  /** True once the repeat-fatal circuit breaker has latched (see `#repeated_failure_blocked`). */
  get is_repeated_failure_blocked(): boolean {
    return this.#repeated_failure_blocked
  }

  start() {
    if (this.#timer || this.#stopped)
      return
    this.#timer = setInterval(() => { void this.sync_if_needed() }, DICT_SYNC_INTERVAL_MS)
    this.#stuck_timer = setInterval(() => { this.check_stuck_dirty().catch(() => { /* telemetry only */ }) }, STUCK_DIRTY_CHECK_MS)
  }

  stop() {
    this.#stopped = true
    if (this.#timer) {
      clearInterval(this.#timer)
      this.#timer = null
    }
    if (this.#stuck_timer) {
      clearInterval(this.#stuck_timer)
      this.#stuck_timer = null
    }
  }

  /**
   * Watchdog: local writes that survive two consecutive checks (~5 min apart)
   * aren't draining — the sync loop is wedged, auth is silently broken, or a
   * table never gets pushed. Counts regardless of editor role: dirty rows held
   * by a NON-editor (role/login lost after writing) are the most dangerous
   * variant. Per-attempt failures ship separately (`sync_failed`); this is the
   * durable "user's work is stuck" signal.
   */
  async check_stuck_dirty(): Promise<void> {
    if (this.#stopped)
      return
    let dirty_rows = 0
    for (const table of DICT_SYNCABLE_TABLES) {
      const rows = await this.#connection.query<{ c: number }>(`SELECT COUNT(*) AS c FROM "${table}" WHERE dirty = 1`)
      dirty_rows += rows[0]?.c ?? 0
    }
    const delete_rows = await this.#connection.query<{ c: number }>(`SELECT COUNT(*) AS c FROM deletes`)
    const deletes = delete_rows[0]?.c ?? 0
    const pending = dirty_rows + deletes > 0
    if (pending && this.#pending_at_last_check) {
      report_dict_stuck_dirty({
        dict_id: this.#dict_id,
        dirty_rows,
        deletes,
        last_sync_at: this.#last_sync_at,
        last_error: this.#last_error,
      })
    }
    this.#pending_at_last_check = pending
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
    // A latched schema-outdated block is permanent until the tab reloads onto a
    // fresh bundle — retrying just re-hits the same 409 every 30s (the storm).
    // Same for a latched repeat-failure block (the breaker tripped).
    if (this.#version_blocked || this.#repeated_failure_blocked || this.#in_flight || this.#stopped)
      return
    await this.sync_once().catch((err) => {
      console.warn(`[dict-sync] ${this.#dict_id} sync failed:`, err)
    })
  }

  async sync_once(): Promise<DictChangesResponse | null> {
    if (this.#in_flight)
      return null
    if (this.#repeated_failure_blocked) {
      // The breaker tripped — the same failure would just recur. A reload
      // (fresh engine + possibly fresh bundle) is the way out; the broadcast
      // prompt says so. Direct calls (post-write flush, sync_now RPC) must not
      // bypass the halt or they'd keep re-pushing the doomed payload.
      return null
    }
    this.#in_flight = true
    this.#on_status?.({ is_syncing: true, last_error: this.#last_error, last_sync_at: this.#last_sync_at })

    try {
      const request = await this.#build_request()
      const response = await this.#post(request)
      await this.#apply_response(response, request)
      this.#last_error = null
      this.#last_sync_at = new Date().toISOString()
      this.#repeat_tracker.reset()
      return response
    } catch (err) {
      this.#last_error = (err as Error).message
      // Ship to client_logs from the worker (single chokepoint for interval,
      // post-write, and RPC syncs) — the shipper classifies, skips pure-offline
      // failures, and throttles repeats. See report-dict-sync-failure.ts.
      report_dict_sync_failure({ dict_id: this.#dict_id, error: err })
      // Dead OPFS handle: retrying is pointless (every future tick fails the
      // same way) — hand recovery to the instance, which stops this engine and
      // reopens the connection in place.
      if (is_storage_lost_error(err)) {
        this.#on_storage_lost?.()
      } else if (!this.#version_blocked && classify_sync_failure(err) === 'client_behind') {
        // Stale bundle (server dict schema is newer, HTTP 409): permanent until
        // reload. Latch the block so the 30s interval stops hammering, and fire
        // the recovery hook ONCE so the instance broadcasts `schema_outdated`
        // (the interval path otherwise never reached `translate_sync_error`, so
        // a tab that went stale post-load retried forever and never reloaded).
        // `server_behind` is deliberately NOT latched: it's transient (server
        // mid-deploy) and self-heals on the next tick, like the admin engine.
        this.#version_blocked = true
        this.#on_version_blocked?.()
      } else {
        // Repeat-fatal circuit breaker (cross-app hardening Part 2): the same
        // non-transient failure N× in a row means retrying is pointless and
        // noisy — halt and prompt the user instead of silently looping.
        const message = (err as Error).message ?? String(err)
        const kind = classify_sync_failure(err)
        const { halt, consecutive } = this.#repeat_tracker.record({ kind, message })
        // FK self-heal: 2nd consecutive fk_constraint → hand recovery to the
        // instance (flush push + reset to a fresh snapshot) BEFORE the breaker
        // halts at 3. Once per engine lifetime — the rebuild constructs a fresh
        // engine; if the heal fails the breaker takes over as before.
        if (kind === 'fk_constraint' && consecutive >= 2 && !this.#integrity_wedged_fired) {
          this.#integrity_wedged_fired = true
          this.#on_integrity_wedged?.()
        }
        if (halt && !this.#repeated_failure_blocked) {
          this.#repeated_failure_blocked = true
          this.#on_repeated_failure?.({ message, consecutive })
        }
      }
      throw err
    } finally {
      this.#in_flight = false
      this.#on_status?.({ is_syncing: false, last_error: this.#last_error, last_sync_at: this.#last_sync_at })
    }
  }

  async #build_request(): Promise<DictChangesRequest> {
    const synced_up_to = await this.#read_cursor()

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
    // from the leader worker. `credentials: 'include'` is belt-and-braces.
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

  async #apply_response(response: DictChangesResponse, request: DictChangesRequest): Promise<void> {
    const affected = new Set<string>()
    const deleted_rows: { table_name: string, id: string }[] = []

    await this.#serialize(() => this.#apply_transaction({ response, request, affected, deleted_rows }))

    if (affected.size > 0)
      this.#on_tables_changed?.(affected)
    if (deleted_rows.length > 0)
      this.#on_rows_deleted?.(deleted_rows)
  }

  async #apply_transaction({ response, request, affected, deleted_rows }: {
    response: DictChangesResponse
    request: DictChangesRequest
    affected: Set<string>
    deleted_rows: { table_name: string, id: string }[]
  }): Promise<void> {
    await this.#connection.execute('PRAGMA defer_foreign_keys = ON')
    await this.#connection.execute('BEGIN')
    try {
      // Deletes are applied BEFORE upserts (parity with house's 2026-07-05 fix).
      // Every dict junction table (entry_tags, entry_dialects, sense_photos,
      // sense_sentences, audio_speakers, …) carries a synthetic-UUID PK PLUS a
      // natural-key UNIQUE that `#upsert_row`'s `ON CONFLICT(id)` does NOT cover,
      // and a junction link is replace-all: unlink then re-link the SAME natural
      // key tombstones the OLD id and inserts a BRAND-NEW id (link_junction_local
      // no-ops only while a row is present). If one `/changes` window carries both
      // the delete for the old id and the upsert for the new row, upserting first
      // re-inserts the natural key while the stale old row is still present →
      // `UNIQUE constraint failed` → the whole apply rolls back and this dict wedges
      // into a retry loop. Clearing the delete first frees the natural key.
      // Ids we just pushed this round. If the server tells us to delete one of
      // them, our push was authoritatively superseded — the natural-key dedup
      // adopted a canonical id and tombstoned our loser (see
      // DICT_NATURAL_KEY_COLUMNS in dictionary-sync-helpers). Honor that delete
      // rather than skipping it as a "stale local edit": the local loser still
      // owns the natural key, so skipping would make the canonical row's upsert
      // below throw the same UNIQUE error and wedge this client into a
      // retry-forever loop (house's Wayne wedge, 2026-07-08).
      const pushed_ids: Record<string, Set<string>> = {}
      for (const table of DICT_SYNCABLE_TABLES)
        pushed_ids[table] = new Set((request.dirty_rows?.[table] ?? []).map(pushed => (pushed as { id: string }).id))

      for (const { table_name, id } of response.deletes) {
        // Local row may be dirty (we pushed it this round). If so, skip the
        // delete — server already accepted our newer write.
        const local = await this.#connection.query<{ dirty: number | null }>(
          `SELECT dirty FROM "${table_name}" WHERE id = ?`,
          [id],
        )
        let is_dirty = local.length > 0 && local[0].dirty === 1
        if (is_dirty && pushed_ids[table_name]?.has(id))
          is_dirty = false
        if (!is_dirty) {
          await this.#connection.execute(`DELETE FROM "${table_name}" WHERE id = ?`, [id])
          affected.add(table_name)
          deleted_rows.push({ table_name, id })
        }
      }

      for (const table of DICT_SYNCABLE_TABLES) {
        const rows = response.changes[table]
        if (!rows?.length)
          continue
        for (const row of rows) {
          await this.#upsert_row({ table, row })
        }
        affected.add(table)
      }

      // Clear dirty flags ONLY on the rows we actually pushed (keyed by id), not a blanket
      // `WHERE dirty = 1`. A blanket clear would silently drop rows inserted AFTER
      // #build_request snapshotted but DURING this sync's network round-trip (writes only
      // serialize against the apply-transaction, not the fetch), marking them clean without
      // ever pushing them — they'd never reach the server. Matches the example engine.
      if (this.#has_editor_role) {
        for (const table of DICT_SYNCABLE_TABLES) {
          for (const row of request.dirty_rows[table] ?? [])
            await this.#connection.execute(`UPDATE "${table}" SET dirty = NULL WHERE id = ?`, [(row as { id: string }).id])
        }
        // Drain only the tombstones we actually pushed (a delete added mid-flight stays queued).
        for (const { table_name, id } of request.deletes ?? [])
          await this.#connection.execute(`DELETE FROM deletes WHERE table_name = ? AND id = ?`, [table_name, id])
      }

      // Persist the new watermark in db_metadata for next sync. `ON CONFLICT DO
      // UPDATE`, never `INSERT OR REPLACE` (delete+reinsert breaks upsert
      // semantics under triggers — shared sync invariant).
      await this.#connection.execute(
        `INSERT INTO db_metadata (key, value) VALUES ('synced_seq', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [String(response.new_synced_up_to)],
      )

      await this.#connection.execute('COMMIT')
    } catch (err) {
      await this.#connection.execute('ROLLBACK')
      throw err
    }
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

  /**
   * The pull cursor: `db_metadata.synced_seq` — written by every sync apply,
   * and BAKED into fresh snapshots by the server (R2 builder + /db endpoint),
   * so a snapshot boot starts pulling from exactly the snapshot's high-water
   * mark. Absent on a pre-server_seq local file (the old ISO cursor under
   * `last_modified_at` is ignored) → null → the instance's transition rebuild
   * handles it (OPFS) or a full pull backfills (MemoryVFS).
   */
  async #read_cursor(): Promise<number | null> {
    const rows = await this.#connection.query<{ value: string }>(
      `SELECT value FROM db_metadata WHERE key = ?`,
      ['synced_seq'],
    )
    if (!rows[0]?.value)
      return null
    const seq = Number(rows[0].value)
    return Number.isFinite(seq) ? seq : null
  }

  /**
   * Push-only flush used by the instance's `rebuild()` self-heal: send dirty
   * rows + tombstones so the server has them, but DON'T apply the response —
   * the local DB is about to be discarded for a fresh snapshot (applying is
   * what keeps failing in the FK-wedge state). Throws on transport/server
   * failure so the caller can abort the rebuild rather than lose local work.
   * No-op (returns false) when there's nothing pending.
   */
  async flush_push_only(): Promise<boolean> {
    const request = await this.#build_request()
    const has_pending = Object.values(request.dirty_rows ?? {}).some(rows => rows && rows.length > 0)
      || (request.deletes?.length ?? 0) > 0
    if (!has_pending)
      return false
    await this.#post(request)
    return true
  }
}
