/**
 * Shared contract between the generic leader-worker host (`leader-worker.ts`) and
 * LD's per-dictionary DB instance (`../dict-instance.ts`). Ported from house's
 * `worker/instance.ts` with the role axis removed: LD keys everything by
 * `dict_id` alone — viewer + editor share ONE OPFS file (`dictionaries/<id>.db`)
 * and the editor capability is promoted in place via `set_role`.
 */

export interface AuthHeaders {
  /**
   * Optional JWT bearer for non-browser callers (CLI scripts, future API
   * integrations). Browser tabs rely on the httpOnly `session` cookie which
   * `fetch()` auto-attaches to same-origin requests — they pass `{}`.
   */
  bearer?: string
}

/** RPC request payloads carried over the transport. */
export type DbRequest
  = | { type: 'query', sql: string, params?: unknown[] }
    | { type: 'exec', sql: string, params?: unknown[], affected_tables?: string[], deleted_rows?: { table_name: string, id: string }[] }
  /** Atomic multi-statement write — dispatched to a `dict-writes.ts` orchestrator inside BEGIN/COMMIT. */
    | { type: 'dict_write', op: string, args: Record<string, unknown> }
    | { type: 'sync_now' }
  /** Promote the leader's engine to editor-push (idempotent) + refresh auth. */
    | { type: 'set_role', has_editor_role: boolean, auth: AuthHeaders }
  /** Drop the OPFS file + refetch the snapshot from scratch (danger zone). */
    | { type: 'reset' }

/** Broadcast events fanned out from the leader to every tab. */
export type DbEvent
  = | { type: 'tables_changed', tables: string[] }
  /**
   * A sync pull (or a remote tab's exec) hard-deleted these rows. Receiving
   * tabs drop them from their per-tab Orama index — a deleted row vanishes
   * from the `updated_at` delta scan, so it can't be discovered any other way.
   */
    | { type: 'rows_deleted', deletes: { table_name: string, id: string }[] }
    | { type: 'sync_status', is_syncing: boolean, last_error: string | null, last_sync_at: string | null }
    | { type: 'snapshot_expired' }
    | { type: 'schema_outdated' }

/** Leader metadata announced to clients on `ready`. */
export interface LeaderMeta {
  /** OPFS-backed (true) vs MemoryVFS fallback (false → refetch every boot). */
  persistent: boolean
  schema_version: string
  has_editor_role: boolean
}

/**
 * Optional byte-level detail on a `snapshot_fetch` progress tick, forwarded to
 * the main thread so the boot UI can render a download progress bar.
 * `total_bytes` is absent when the source didn't advertise it (public R2) →
 * indeterminate bar.
 */
export interface BootProgressDetail {
  received_bytes?: number
  total_bytes?: number
}

export interface InstanceContext {
  emit_event: (event: DbEvent) => void
  /**
   * Boot progress tick. Resets the idle boot watchdog (so a slow-but-progressing
   * snapshot download never false-times-out) AND records `stage` as the
   * last-reached boot phase, which the host attaches to `boot_failed` telemetry
   * so a stall points at the exact phase (`snapshot_fetch`, `opfs_open`, …).
   * The optional `detail` carries byte counts during `snapshot_fetch` for the
   * boot download progress bar. A harmless no-op once the instance has booted.
   * Optional so non-LD hosts / tests can omit it.
   */
  report_progress?: (stage: string, detail?: BootProgressDetail) => void
}

/** A live DB instance owned by the leader worker. */
export interface DbInstance {
  handle: (request: DbRequest) => Promise<unknown>
  meta: () => LeaderMeta
  shutdown: () => Promise<void>
}

export type InstanceFactory = (context: InstanceContext) => Promise<DbInstance>

export interface InstanceOptions {
  dict_id: string
  has_editor_role: boolean
  auth: AuthHeaders
  /** The spawning tab's remote-log session id — correlates worker telemetry rows with the leader tab's session. */
  session_id?: string | null
}

export interface WorkerInitMessage {
  channel_name: string
  instance_options: InstanceOptions
  /** Boot-watchdog idle cap; the host trips the factory after this long with no progress (default `BOOT_IDLE_TIMEOUT_MS`). */
  boot_timeout_ms?: number
  /** Synthetic boot fault for the wedge harness (`boot-recovery.ts`); unset in prod. */
  boot_fault?: 'hang' | 'throw'
}

/** Surfaced to the main-thread `on_boot_failed` hook so the app can log a `boot_failed` to telemetry. */
export interface BootFailure {
  message: string
  /** Last boot phase the worker reported before it failed (`snapshot_fetch`, `opfs_open`, …). */
  last_stage?: string
  /** 0-based attempt index that failed. */
  attempt: number
  /** Whether the spawning tab will retry its own boot (vs. resign leadership). */
  will_retry: boolean
}

/**
 * Channel + lock names — keyed by dict_id ALONE (not role): viewer + editor
 * share one OPFS file and the SAH is exclusive per file, so there must be
 * exactly one leader per dictionary. Two open dicts never cross-talk.
 */
export function db_channel_name(dict_id: string): string {
  return `ld-db-${dict_id}`
}

export function db_lock_name(dict_id: string): string {
  return `${db_channel_name(dict_id)}-leader`
}
