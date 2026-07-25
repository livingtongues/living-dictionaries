/**
 * The team's cross-dictionary view of import conversations
 * (`.issues/import-conversations.md`).
 *
 * These threads are deliberately absent from /admin/messages — both sides work
 * them on the dictionary's own page — so without this index an import with no
 * recent activity would be invisible, which is exactly how one gets forgotten.
 *
 * Server-authoritative rather than local-first because the counts that make the
 * list useful (`thread_questions`, `thread_artifacts`, `source_files`) are all
 * server-only tables that never sync to admin clients.
 */
import type { RequestHandler } from './$types'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

export interface AdminImportRow {
  thread_id: string
  dictionary_id: string
  dictionary_name: string | null
  dictionary_url: string | null
  requester_name: string | null
  requester_email: string
  assignee_name: string | null
  assignee_email: string | null
  created_at: string
  last_message_at: string
  started_at: string | null
  resolved_at: string | null
  resource_count: number
  open_questions: number
  answered_questions: number
  artifact_count: number
  /** Activity since we marked it resolved — the reason to look again. */
  has_activity_since_resolve: boolean
}

export interface AdminImportsGetResponseBody {
  imports: AdminImportRow[]
}

export const GET: RequestHandler = async (event) => {
  const { email } = await verify_auth(event)
  if (!is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admins only')

  const rows = get_shared_db().prepare(`
    SELECT
      t.id AS thread_id,
      t.dictionary_id,
      d.name AS dictionary_name,
      d.url AS dictionary_url,
      t.from_name AS requester_name,
      t.from_email AS requester_email,
      assignee.name AS assignee_name,
      assignee.email AS assignee_email,
      t.created_at,
      t.last_message_at,
      t.started_at,
      t.resolved_at,
      (SELECT COUNT(*) FROM source_files f WHERE f.import_thread_id = t.id) AS resource_count,
      (SELECT COUNT(*) FROM thread_questions q WHERE q.thread_id = t.id AND q.status = 'open') AS open_questions,
      (SELECT COUNT(*) FROM thread_questions q WHERE q.thread_id = t.id AND q.status = 'answered') AS answered_questions,
      (SELECT COUNT(*) FROM thread_artifacts a WHERE a.thread_id = t.id) AS artifact_count
    FROM message_threads t
    LEFT JOIN dictionaries d ON d.id = t.dictionary_id
    LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
    WHERE t.thread_kind = 'import'
    ORDER BY t.last_message_at DESC
  `).all() as Omit<AdminImportRow, 'has_activity_since_resolve'>[]

  return json({
    imports: rows.map(row => ({
      ...row,
      has_activity_since_resolve: !!row.resolved_at && row.last_message_at > row.resolved_at,
    })),
  } satisfies AdminImportsGetResponseBody)
}
