import type { RequestHandler } from './$types'
import type { ImportRequestSummary } from '$lib/import/types'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { actor_label, append_import_request_followup, list_import_requests, require_import_request_owner } from '$lib/import/server/import-request-thread'
import { notify_admin } from '$lib/notifications/notify-admins'
import { error, json } from '@sveltejs/kit'

export interface V1ImportRequestPatchRequestBody {
  request_note: string | null
}

export interface V1ImportRequestPatchResponseBody {
  request: ImportRequestSummary
}

/** PATCH an import batch's overall note and append the change to its message thread. */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const body = await event.request.json() as Partial<V1ImportRequestPatchRequestBody>
  if (!('request_note' in body))
    error(ResponseCodes.BAD_REQUEST, 'request_note is required')

  const db = get_shared_db()
  const { thread_id } = event.params
  require_import_request_owner({ db, dictionary_id: dictionary.id, thread_id, access })
  const { import_request_note: current_request_note } = db.prepare('SELECT import_request_note FROM message_threads WHERE id = ?')
    .get(thread_id) as { import_request_note: string | null }
  const request_note = body.request_note?.trim() || null
  if (current_request_note === request_note) {
    const unchanged = list_import_requests({ db, dictionary_id: dictionary.id, access })
      .find(request => request.thread_id === thread_id)
    if (!unchanged)
      error(ResponseCodes.NOT_FOUND, 'import request not found')
    return json({ request: unchanged } satisfies V1ImportRequestPatchResponseBody)
  }

  let assigned_email: string | null = null
  const update = db.transaction(() => {
    db.prepare('UPDATE message_threads SET import_request_note = ?, updated_at = ? WHERE id = ?')
      .run(request_note, new Date().toISOString(), thread_id)
    const { assigned_email: email } = append_import_request_followup({
      db,
      dictionary_id: dictionary.id,
      thread_id,
      access,
      body_text: [
        `Import request note updated by ${actor_label({ db, user_id: access.user_id })}.`,
        '',
        request_note || '(The request note was removed.)',
      ].join('\n'),
    })
    assigned_email = email
  })
  update()

  void notify_admin({
    email: assigned_email,
    subject: `Import request updated: ${dictionary.name}`,
    body: `${actor_label({ db, user_id: access.user_id })} updated the overall request note.`,
    link: `${event.url.origin}/admin/messages/${thread_id}`,
  })
  const request = list_import_requests({ db, dictionary_id: dictionary.id, access })
    .find(summary => summary.thread_id === thread_id)
  if (!request)
    error(ResponseCodes.NOT_FOUND, 'import request not found')
  return json({ request } satisfies V1ImportRequestPatchResponseBody)
}
