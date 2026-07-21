import type { SourceFileRow } from '$lib/db/server/source-files'

export interface ImportRequestSummary {
  thread_id: string
  request_note: string | null
  requested_at: string
  can_manage: boolean
}

export interface ImportFileForClient extends SourceFileRow {
  can_manage_requested: boolean
}
