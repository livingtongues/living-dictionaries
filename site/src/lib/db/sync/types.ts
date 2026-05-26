import type { RowType } from '$lib/db/client/live/types'

/**
 * Tables in shared.db that admins can read (and most cases write) via the
 * single `/api/admin-sync` endpoint. Per Q-shared.3 in
 * port-db-sync-architecture.md, LD uses ONE sector — all admin-visible tables
 * sync together with a single watermark.
 *
 * Server-only tables NOT in this list (created on the admin client but never
 * synced):
 *   - email_codes      (OTP secrets, short-lived)
 *   - email_aliases    (mail-routing plumbing, server is sole writer)
 *   - client_logs      (high-volume; admins query via dedicated endpoint)
 */
export type SyncableTableName
  = | 'users'
    | 'dictionaries'
    | 'dictionary_roles'
    | 'invites'
    | 'message_threads'
    | 'messages'
    | 'message_attachments'

/**
 * Order matters within the array — parents before children for FK safety.
 *   users → dictionaries (created_by_user_id, updated_by_user_id)
 *   dictionaries → dictionary_roles, invites
 *   users → dictionary_roles, invites
 *   users → message_threads → messages → message_attachments
 */
export const SYNCABLE_TABLE_NAMES: readonly SyncableTableName[] = Object.freeze([
  'users',
  'dictionaries',
  'dictionary_roles',
  'invites',
  'message_threads',
  'messages',
  'message_attachments',
])

/** Runtime membership check for arbitrary string input. */
export const SYNCABLE_TABLES: ReadonlySet<string> = new Set<string>(SYNCABLE_TABLE_NAMES)

export function is_syncable_table(table_name: string): table_name is SyncableTableName {
  return SYNCABLE_TABLES.has(table_name)
}

/**
 * Tables admins can never write directly via sync (defense in depth — the
 * server still strips writes). Empty for now; reserved for future server-only
 * mirror tables that admin clients still need to READ via sync.
 */
export const READONLY_TABLES: ReadonlySet<SyncableTableName> = new Set<SyncableTableName>()

export function is_readonly_table(table: SyncableTableName): boolean {
  return READONLY_TABLES.has(table)
}

/**
 * Wire shape for a syncable table row. JSON columns flow as parsed objects.
 * `dirty` is local bookkeeping — the server strips it on receive and clears
 * it before sending rows back; optional on the wire type.
 */
export type SyncRow<K extends SyncableTableName>
  = Omit<RowType<K>, 'dirty' | '_save' | '_delete' | '_reset'>
    & { dirty?: number | null }

export interface SyncRequest {
  synced_up_to: string | null
  dirty_rows: { [K in SyncableTableName]?: SyncRow<K>[] }
  deletes: { table_name: string, id: string }[]
  /**
   * Filename of the most recent shared-migration bundled with this client.
   * Server compares against its own bundled latest. Mismatches return 409
   * (client behind — needs reload) or 503 (server behind — retry shortly).
   */
  latest_migration: string
  /**
   * Once-per-day ping. When `true`, the server bumps
   * `users.last_visit_at = now WHERE id = caller_user_id`.
   */
  update_last_visit?: boolean
}

export interface SyncResponse {
  new_synced_up_to: string | null
  changes: { [K in SyncableTableName]?: SyncRow<K>[] }
  deletes: { table_name: string, id: string }[]
}

export interface SyncResult {
  success: boolean
  items_uploaded: number
  items_downloaded: number
  deletes_pushed: number
  deletes_pulled: number
  error: string | null
  duration_ms: number
  last_sync_time: string | null
}

export interface SyncLogEntry {
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'success'
  phase: string
  table?: string
  message: string
  detail?: string
  row_count?: number
}

export interface SyncReport {
  started_at: string
  finished_at: string
  success: boolean
  summary: string
  duration_ms: number
  items_uploaded: number
  items_downloaded: number
  deletes_pushed: number
  deletes_pulled: number
  error: string | null
  entries: SyncLogEntry[]
}
