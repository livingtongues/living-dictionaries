import type { DictSyncableTable } from '$lib/db/server/dictionary-sync-helpers'

/**
 * RPC message shapes for the dict.db SharedWorker (Story B.1).
 *
 * Each tab connects to the SharedWorker via a `MessagePort` and posts
 * `RequestEnvelope`s; the worker responds with `ResponseEnvelope`s tagged by
 * the same `req_id`. The worker also fans out `BroadcastMessage`s (table
 * change notifications, sync status updates, snapshot-fetch errors) to ALL
 * ports holding a refcount on the affected dict — including the originator,
 * which is a no-op because its local state already matches.
 *
 * Keep this surface small: ~5 commands. Once wired, it shouldn't churn.
 */

export interface AuthHeaders {
  /**
   * Optional JWT bearer for non-browser callers (CLI scripts, future API
   * integrations). Browser tabs rely on the httpOnly `session` cookie which
   * `fetch()` auto-attaches to same-origin requests — they pass `{}`.
   */
  bearer?: string
}

export interface OpenRequest {
  type: 'open'
  req_id: number
  dict_id: string
  /**
   * Whether the calling tab has push permission. Determines:
   *   - Whether to fetch snapshot from VPS (`/api/dictionary/[id]/db` with auth)
   *     or R2 (`https://snapshots.livingdictionaries.app/...`).
   *   - Whether to include push side in the sync engine.
   *   - Whether the dict is exempt from OPFS LRU eviction.
   */
  has_editor_role: boolean
  /** Caller auth context, forwarded to the snapshot fetch. */
  auth: AuthHeaders
}

export interface QueryRequest {
  type: 'query'
  req_id: number
  dict_id: string
  sql: string
  params?: unknown[]
}

export interface ExecRequest {
  type: 'exec'
  req_id: number
  dict_id: string
  sql: string
  params?: unknown[]
  /** Which tables this write affected — broadcast hints (saves a SQL probe). */
  affected_tables?: string[]
}

export interface CloseRequest {
  type: 'close'
  req_id: number
  dict_id: string
}

export interface ByeRequest {
  type: 'bye'
  req_id: number
}

export interface RefreshAuthRequest {
  type: 'refresh_auth'
  req_id: number
  auth: AuthHeaders
}

export interface SyncNowRequest {
  type: 'sync_now'
  req_id: number
  dict_id: string
}

export type RequestEnvelope
  = OpenRequest
    | QueryRequest
    | ExecRequest
    | CloseRequest
    | ByeRequest
    | RefreshAuthRequest
    | SyncNowRequest

export interface OkResponse<T = unknown> {
  type: 'ok'
  req_id: number
  result: T
}

export interface ErrorResponse {
  type: 'error'
  req_id: number
  code:
    | 'snapshot_expired'
    | 'schema_outdated'
    | 'server_outdated'
    | 'unauthorized'
    | 'role_revoked'
    | 'not_opened'
    | 'opfs_unavailable'
    | 'network'
    | 'internal'
  message: string
}

export type ResponseEnvelope = OkResponse | ErrorResponse

export interface QueryResult {
  rows: Record<string, unknown>[]
}

export interface OpenResult {
  /** Whether the dict's wa-sqlite instance is OPFS-backed (false = MemoryVFS fallback). */
  opfs: boolean
  /** Bundled latest migration applied to the local instance. */
  schema_version: string
  /** Whether the local file was freshly downloaded this open call. */
  was_fresh_fetch: boolean
}

/**
 * Broadcast fired when one or more tables were modified — either by a local
 * write, a sync engine pull, or a remote tab's write that flowed through the
 * SharedWorker. Receiving tabs call `notifier.notify(table_name)` per table,
 * which triggers their `TableStore` to re-query and reconcile rows in place.
 */
export interface TablesChangedBroadcast {
  type: 'tables_changed'
  dict_id: string
  tables: (DictSyncableTable | 'deletes' | string)[]
}

export interface SyncStatusBroadcast {
  type: 'sync_status'
  dict_id: string
  is_syncing: boolean
  last_error: string | null
  last_sync_at: string | null
}

export interface SchemaOutdatedBroadcast {
  type: 'schema_outdated'
  dict_id: string
}

export interface SnapshotExpiredBroadcast {
  type: 'snapshot_expired'
  dict_id: string
}

export type BroadcastMessage
  = TablesChangedBroadcast
    | SyncStatusBroadcast
    | SchemaOutdatedBroadcast
    | SnapshotExpiredBroadcast

export type AnyOutgoingMessage = ResponseEnvelope | BroadcastMessage

export function is_broadcast(message: AnyOutgoingMessage): message is BroadcastMessage {
  return (
    message.type === 'tables_changed'
    || message.type === 'sync_status'
    || message.type === 'schema_outdated'
    || message.type === 'snapshot_expired'
  )
}
