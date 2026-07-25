import type { SourceFileRow } from '$lib/db/server/source-files'

export interface ImportRequestSummary {
  thread_id: string
  request_note: string | null
  requested_at: string
  can_manage: boolean
  /** Set when our team closed the request thread — the job is done. Until then the request stays on the manager's Import page, even after we file its resources under a source. */
  resolved_at: string | null
}

export interface ImportFileForClient extends SourceFileRow {
  can_manage_requested: boolean
}
