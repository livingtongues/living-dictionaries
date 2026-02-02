export interface SyncResult {
  success: boolean
  items_uploaded: number
  items_downloaded: number
  deletes_pushed: number
  deletes_pulled: number
  errors: SyncError[]
  duration_ms: number
  last_sync_time: string | null
}

export interface SyncError {
  operation: 'upload' | 'download' | 'delete_push' | 'delete_pull'
  table_name: string
  id: string
  error: string
}

// Only tables that exist in both local PGlite and Supabase for admin sync
export type SyncableTableName =
  | 'users'
  | 'user_data'
  | 'dictionaries'
  | 'dictionary_roles'
  | 'invites'

export interface TableFetchResult {
  table_name: SyncableTableName
  to_upload: any[]
  to_download: any[]
  errors: SyncError[]
}
