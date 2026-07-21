import type { Database } from 'better-sqlite3'
import type { DictApiAccess } from '$lib/auth/verify-dict-api-access'
import type { SourceFileRow } from '$lib/db/server/source-files'
import type { ImportRequestSummary } from '$lib/import/types'
import { randomUUID } from 'node:crypto'
import { is_admin } from '$lib/admins'
import { ResponseCodes } from '$lib/constants'
import { error } from '@sveltejs/kit'

interface ImportThreadRow {
  id: string
  from_user_id: string | null
  assigned_email: string | null
}

function is_site_admin_user({ db, user_id }: { db: Database, user_id: string }): boolean {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(user_id) as { email: string } | undefined
  return is_admin(user?.email)
}

export function can_manage_requested_file({ db, access, file }: {
  db: Database
  access: DictApiAccess
  file: SourceFileRow
}): boolean {
  return file.uploaded_by_user_id === access.user_id || is_site_admin_user({ db, user_id: access.user_id })
}

export function require_requested_file_owner({ db, access, file }: {
  db: Database
  access: DictApiAccess
  file: SourceFileRow
}): void {
  if (!can_manage_requested_file({ db, access, file }))
    error(ResponseCodes.FORBIDDEN, 'Only the original uploader or a site admin can change a requested resource')
}

function get_import_thread({ db, dictionary_id, thread_id }: {
  db: Database
  dictionary_id: string
  thread_id: string
}): ImportThreadRow | null {
  const row = db.prepare(`
    SELECT
      message_threads.id,
      message_threads.from_user_id,
      assigned_user.email AS assigned_email
    FROM message_threads
    LEFT JOIN users AS assigned_user ON assigned_user.id = message_threads.assigned_to_user_id
    WHERE message_threads.id = ?
      AND message_threads.dictionary_id = ?
      AND EXISTS (
        SELECT 1 FROM source_files
        WHERE source_files.import_thread_id = message_threads.id
          AND source_files.dictionary_id = ?
      )
  `).get(thread_id, dictionary_id, dictionary_id) as ImportThreadRow | undefined
  return row ?? null
}

export function require_import_request_owner({ db, dictionary_id, thread_id, access }: {
  db: Database
  dictionary_id: string
  thread_id: string
  access: DictApiAccess
}): ImportThreadRow {
  const thread = get_import_thread({ db, dictionary_id, thread_id })
  if (!thread)
    error(ResponseCodes.NOT_FOUND, 'import request not found')
  if (thread.from_user_id !== access.user_id && !is_site_admin_user({ db, user_id: access.user_id }))
    error(ResponseCodes.FORBIDDEN, 'Only the original requester or a site admin can change this import request')
  return thread
}

export function list_import_requests({ db, dictionary_id, access }: {
  db: Database
  dictionary_id: string
  access: DictApiAccess
}): ImportRequestSummary[] {
  const is_admin_user = is_site_admin_user({ db, user_id: access.user_id })
  const rows = db.prepare(`
    SELECT
      message_threads.id AS thread_id,
      message_threads.import_request_note AS request_note,
      message_threads.from_user_id,
      MIN(source_files.import_requested_at) AS requested_at
    FROM message_threads
    INNER JOIN source_files ON source_files.import_thread_id = message_threads.id
    WHERE source_files.dictionary_id = ?
    GROUP BY message_threads.id
    ORDER BY requested_at DESC
  `).all(dictionary_id) as {
    thread_id: string
    request_note: string | null
    from_user_id: string | null
    requested_at: string
  }[]
  return rows.map(row => ({
    thread_id: row.thread_id,
    request_note: row.request_note,
    requested_at: row.requested_at,
    can_manage: is_admin_user || row.from_user_id === access.user_id,
  }))
}

export function append_import_request_followup({ db, dictionary_id, thread_id, access, body_text, now = new Date().toISOString() }: {
  db: Database
  dictionary_id: string
  thread_id: string
  access: DictApiAccess
  body_text: string
  now?: string
}): { assigned_email: string | null } {
  const thread = get_import_thread({ db, dictionary_id, thread_id })
  if (!thread)
    error(ResponseCodes.NOT_FOUND, 'import request not found')

  db.prepare(`
    INSERT INTO messages (id, thread_id, author_user_id, author_kind, body_text, created_at, updated_at)
    VALUES (?, ?, ?, 'customer', ?, ?, ?)
  `).run(randomUUID(), thread_id, access.user_id, body_text, now, now)
  db.prepare(`
    UPDATE message_threads SET
      last_message_at = ?,
      read_at = NULL,
      replied_at = NULL,
      replied_by_user_id = NULL,
      resolved_at = NULL,
      resolved_by_user_id = NULL,
      updated_at = ?
    WHERE id = ?
  `).run(now, now, thread_id)
  return { assigned_email: thread.assigned_email }
}

export function actor_label({ db, user_id }: { db: Database, user_id: string }): string {
  const actor = db.prepare('SELECT name, email FROM users WHERE id = ?')
    .get(user_id) as { name: string | null, email: string } | undefined
  if (!actor)
    return `User ${user_id}`
  return `${actor.name || actor.email} <${actor.email}>`
}

export function format_file_metadata(file: Pick<SourceFileRow, 'filename' | 'import_instructions' | 'source_note'>): string {
  return [
    `Resource: ${file.filename}`,
    `Instructions: ${file.import_instructions?.trim() || '(none)'}`,
    `Source: ${file.source_note?.trim() || '(none)'}`,
  ].join('\n')
}
