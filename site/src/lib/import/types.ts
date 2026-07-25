import type { SourceFileRow } from '$lib/db/server/source-files'

export interface ImportRequestSummary {
  thread_id: string
  request_note: string | null
  requested_at: string
  can_manage: boolean
  /** Set when our team closed the request. Purely a display state — the conversation and its resources stay put forever. */
  resolved_at: string | null
  /**
   * Set when the team began work (guide Phase 0) — THE freeze rule. Once
   * stamped, the uploaded resources are permanent dictionary history and the
   * uploader can no longer edit, remove, or withdraw them.
   */
  started_at: string | null
}

export interface ImportFileForClient extends SourceFileRow {
  can_manage_requested: boolean
  /** True once the team started the request — the manager's edit/delete controls disappear. */
  is_frozen: boolean
}
