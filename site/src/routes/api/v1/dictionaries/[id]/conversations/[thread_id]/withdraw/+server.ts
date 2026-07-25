import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { require_conversation } from '$lib/import/server/conversation-access'
import { is_site_admin_user } from '$lib/import/server/import-request-thread'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1ConversationWithdrawPostResponseBody {
  result: 'withdrawn'
}

/**
 * POST — take back an import request we have not started yet. The escape hatch
 * for the fat-finger upload: it un-stamps the resources (so they become ordinary
 * editable/deletable uploads again) and removes the conversation. Once
 * `started_at` is set this is refused — from that moment the request is part of
 * the dictionary's permanent record.
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const conversation = require_conversation({ db, dictionary_id: dictionary.id, thread_id: event.params.thread_id })

  const is_admin_user = is_site_admin_user({ db, user_id: access.user_id })
  if (conversation.from_user_id !== access.user_id && !is_admin_user)
    error(ResponseCodes.FORBIDDEN, 'Only the person who made this request can withdraw it')
  if (conversation.started_at)
    error(ResponseCodes.FORBIDDEN, 'We have already started this import, so it can no longer be withdrawn. Post in the conversation if something is wrong.')

  const withdraw = db.transaction(() => {
    db.prepare('UPDATE source_files SET import_requested_at = NULL, import_thread_id = NULL, updated_at = ? WHERE import_thread_id = ? AND dictionary_id = ?')
      .run(new Date().toISOString(), conversation.id, dictionary.id)
    // Children (messages, participants, questions, artifacts) cascade.
    db.prepare('DELETE FROM message_threads WHERE id = ?').run(conversation.id)
  })
  withdraw()

  log_server_event({ level: 'info', message: 'import_request_withdrawn', user_id: access.user_id, context: { dictionary_id: dictionary.id, thread_id: conversation.id, via: access.via } })
  return json({ result: 'withdrawn' } satisfies V1ConversationWithdrawPostResponseBody)
}
