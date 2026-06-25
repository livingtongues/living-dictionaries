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

export interface InstanceContext {
  emit_event: (event: DbEvent) => void
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
}

export interface WorkerInitMessage {
  channel_name: string
  instance_options: InstanceOptions
  /** Boot-watchdog cap; the host times the factory out past this (default `BOOT_TIMEOUT_MS`). */
  boot_timeout_ms?: number
  /** Synthetic boot fault for the wedge harness (`boot-recovery.ts`); unset in prod. */
  boot_fault?: 'hang' | 'throw'
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
