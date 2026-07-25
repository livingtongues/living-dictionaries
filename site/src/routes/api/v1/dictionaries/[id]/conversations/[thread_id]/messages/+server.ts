import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { notify_conversation_activity } from '$lib/db/server/import-conversation-notify'
import { post_conversation_message } from '$lib/db/server/import-conversations'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { author_kind_for, is_team_actor, require_conversation } from '$lib/import/server/conversation-access'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1ConversationMessagesPostRequestBody {
  body_text: string
}

export interface V1ConversationMessagesPostResponseBody {
  message_id: string
}

/**
 * POST a message into an import conversation. Both sides use this — managers
 * from the dictionary page, our team and agents through the same route. Nothing
 * here is private, so there is no visibility flag to get wrong.
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const conversation = require_conversation({ db, dictionary_id: dictionary.id, thread_id: event.params.thread_id })

  const body = await event.request.json() as Partial<V1ConversationMessagesPostRequestBody>
  const body_text = body.body_text?.trim()
  if (!body_text)
    error(ResponseCodes.BAD_REQUEST, 'body_text is required')

  const is_team = is_team_actor({ db, access })
  const author_kind = author_kind_for({ db, access })
  const message_row_id = post_conversation_message({
    db,
    thread_id: conversation.id,
    user_id: access.user_id,
    author_kind,
    body_text,
  })
  // Membership follows the acting human, but an agent key acting for the team
  // must not be filed on the manager side.
  if (is_team) {
    db.prepare(`UPDATE thread_participants SET side = 'team' WHERE thread_id = ? AND user_id = ?`)
      .run(conversation.id, access.user_id)
  }

  void notify_conversation_activity({
    db,
    conversation,
    dictionary_name: dictionary.name,
    dictionary_url: dictionary.url,
    author_user_id: access.user_id,
    message_row_id,
    body_text,
    base_url: event.url.origin,
  })

  log_server_event({ level: 'info', message: 'import_conversation_message', user_id: access.user_id, context: { dictionary_id: dictionary.id, thread_id: conversation.id, author_kind, via: access.via } })
  return json({ message_id: message_row_id } satisfies V1ConversationMessagesPostResponseBody)
}
