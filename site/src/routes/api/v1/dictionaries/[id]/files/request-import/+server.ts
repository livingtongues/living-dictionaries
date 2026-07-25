import type { RequestHandler } from './$types'
import { randomUUID } from 'node:crypto'
import { route_admin_for_imports } from '$lib/agent/triage/routing'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { build_import_request_body } from '$lib/import/server/import-request-body'
import { list_source_files, mark_files_requested } from '$lib/db/server/source-files'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { assign_directed_thread } from '$lib/email/assign-directed-thread'
import { log_server_event } from '$lib/server/log-server-event'
import { notify_admin } from '$lib/notifications/notify-admins'
import { error, json } from '@sveltejs/kit'

export interface V1FilesRequestImportRequestBody {
  /** The uploaded files this request covers. Every file must be confirmed and carry import instructions. */
  file_ids: string[]
  /** Optional overall note for the whole request. */
  message?: string
}

export interface V1FilesRequestImportResponseBody {
  ok: true
  thread_id: string
}

/**
 * POST /api/v1/dictionaries/[id]/files/request-import — "Request we import
 * this": turns a batch of uploaded resources into a message thread for the
 * team, deterministically assigned to the import owner (Jacob). The message
 * body is agent-ready — one copy button on the admin side and the whole job
 * (downloads, per-file instructions, and an ordered runbook pointing at the
 * guides) can be dumped into an agent session.
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const body = await event.request.json() as Partial<V1FilesRequestImportRequestBody>
  const file_ids = Array.isArray(body.file_ids) ? body.file_ids : []
  if (!file_ids.length)
    error(ResponseCodes.BAD_REQUEST, 'file_ids is required')

  const db = get_shared_db()
  const all_files = list_source_files({ db, dictionary_id: dictionary.id })
  const files = file_ids.map((file_id) => {
    const file = all_files.find(row => row.id === file_id)
    if (!file)
      error(ResponseCodes.BAD_REQUEST, `Unknown file id ${file_id}`)
    if (!file.upload_confirmed_at)
      error(ResponseCodes.BAD_REQUEST, `File "${file.filename}" has not finished uploading`)
    if (!file.import_instructions?.trim())
      error(ResponseCodes.BAD_REQUEST, `File "${file.filename}" needs import instructions before requesting`)
    if (file.source_id)
      error(ResponseCodes.BAD_REQUEST, `File "${file.filename}" is already filed under a source — unlink it first if it still needs importing`)
    if (file.import_requested_at)
      error(ResponseCodes.BAD_REQUEST, `File "${file.filename}" is already part of a requested import`)
    return file
  })

  const requester = db.prepare('SELECT id, email, name FROM users WHERE id = ?')
    .get(access.user_id) as { id: string, email: string, name: string | null } | undefined
  if (!requester)
    error(ResponseCodes.BAD_REQUEST, 'Requesting user not found')

  const { origin } = event.url
  const subject = `Import request: ${dictionary.name}`
  const body_text = build_import_request_body({ origin, dictionary, requester, files, note: body.message })

  const thread_id = randomUUID()
  const message_id = randomUUID()
  const now = new Date().toISOString()
  const request_note = body.message?.trim() || null
  const insert = db.transaction(() => {
    db.prepare(`
      INSERT INTO message_threads (
        id, subject, source, from_user_id, from_email, from_name, url,
        dictionary_id, import_request_note, last_message_at, created_at, updated_at
      ) VALUES (?, ?, 'contact_form', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(thread_id, subject, requester.id, requester.email, requester.name ?? null, `${origin}/${dictionary.url}/import`, dictionary.id, request_note, now, now, now)
    db.prepare(`
      INSERT INTO messages (id, thread_id, author_user_id, author_kind, body_text, created_at, updated_at)
      VALUES (?, ?, ?, 'customer', ?, ?, ?)
    `).run(message_id, thread_id, requester.id, body_text, now, now)
  })
  insert()

  mark_files_requested({ db, dictionary_id: dictionary.id, file_ids: files.map(file => file.id), thread_id, now })

  const import_admin = route_admin_for_imports()
  if (import_admin) {
    assign_directed_thread({ db, thread_id, admin: import_admin, now })
    void notify_admin({
      email: import_admin.email,
      subject: `Import request: ${dictionary.name}`,
      body: `${requester.name || requester.email} uploaded ${files.length} resource${files.length === 1 ? '' : 's'} to import.`,
      link: `${origin}/admin/messages/${thread_id}`,
    })
  }

  log_server_event({ level: 'info', message: 'import_requested', user_id: access.user_id, context: { dictionary_id: dictionary.id, thread_id, file_count: files.length, via: access.via } })
  return json({ ok: true, thread_id } satisfies V1FilesRequestImportResponseBody)
}
