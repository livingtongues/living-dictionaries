import type { RequestHandler } from './$types'
import type { SourceFileRow } from '$lib/db/server/source-files'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { require_conversation, require_team } from '$lib/import/server/conversation-access'
import { build_import_request_body } from '$lib/import/server/import-request-body'
import { error, json } from '@sveltejs/kit'

export interface V1ConversationBriefGetResponseBody {
  brief: string
}

/**
 * GET the agent-ready kickoff runbook for this request — the text Jacob pastes
 * into an agent session.
 *
 * It is DERIVED, never stored: an import conversation has no internal messages
 * (`.issues/import-conversations.md`), and regenerating means the brief always
 * matches the current guides instead of whatever they said the day the request
 * came in. Team only; the "Copy job brief" button is admin-gated in the UI too.
 */
export const GET: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const conversation = require_conversation({ db, dictionary_id: dictionary.id, thread_id: event.params.thread_id })
  require_team({ db, access })

  const files = db.prepare('SELECT * FROM source_files WHERE import_thread_id = ? AND dictionary_id = ? ORDER BY created_at')
    .all(conversation.id, dictionary.id) as SourceFileRow[]
  if (!files.length)
    error(ResponseCodes.NOT_FOUND, 'this request has no resources left')

  const requester = conversation.from_user_id
    ? db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(conversation.from_user_id) as { id: string, email: string, name: string | null } | undefined
    : undefined

  return json({
    brief: build_import_request_body({
      origin: event.url.origin,
      dictionary,
      requester: requester ?? { id: conversation.from_user_id ?? 'unknown', email: conversation.from_email, name: conversation.from_name },
      files,
      note: conversation.import_request_note,
      thread_id: conversation.id,
    }),
  } satisfies V1ConversationBriefGetResponseBody)
}
