import type { RequestHandler } from './$types'
import type { ConversationRow } from '$lib/db/server/import-conversations'
import {
  count_open_questions,
  count_unread_for_user,
  list_artifacts,
  list_conversations,
} from '$lib/db/server/import-conversations'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { json } from '@sveltejs/kit'

export interface ConversationSummary extends ConversationRow {
  /** Messages the caller has not seen yet. */
  unread: number
  open_questions: number
  artifact_count: number
  resource_count: number
}

export interface V1ConversationsGetResponseBody {
  conversations: ConversationSummary[]
}

/**
 * GET /api/v1/dictionaries/[id]/conversations — every import conversation for
 * this dictionary, newest first. Nothing is ever hidden: a finished import stays
 * listed forever as the dictionary's permanent record of what was handed over.
 */
export const GET: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const resource_counts = db.prepare('SELECT import_thread_id, COUNT(*) AS count FROM source_files WHERE dictionary_id = ? AND import_thread_id IS NOT NULL GROUP BY import_thread_id')
    .all(dictionary.id) as { import_thread_id: string, count: number }[]

  const conversations = list_conversations({ db, dictionary_id: dictionary.id }).map(conversation => ({
    ...conversation,
    unread: count_unread_for_user({ db, thread_id: conversation.id, user_id: access.user_id }),
    open_questions: count_open_questions({ db, thread_id: conversation.id }),
    artifact_count: list_artifacts({ db, thread_id: conversation.id }).length,
    resource_count: resource_counts.find(row => row.import_thread_id === conversation.id)?.count ?? 0,
  }))
  return json({ conversations } satisfies V1ConversationsGetResponseBody)
}
