import type { RequestHandler } from './$types'
import { mark_conversation_read } from '$lib/db/server/import-conversations'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { is_team_actor, require_conversation } from '$lib/import/server/conversation-access'
import { json } from '@sveltejs/kit'

export interface V1ConversationReadPostResponseBody {
  result: 'read'
}

/**
 * POST — mark the conversation read for the caller. A TEAM read also advances
 * `activity_batch`, which re-arms the Notifications-room notice so the next
 * manager post announces itself again (one notice per unread batch).
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const conversation = require_conversation({ db, dictionary_id: dictionary.id, thread_id: event.params.thread_id })

  mark_conversation_read({
    db,
    thread_id: conversation.id,
    user_id: access.user_id,
    side: is_team_actor({ db, access }) ? 'team' : 'manager',
  })
  return json({ result: 'read' } satisfies V1ConversationReadPostResponseBody)
}
