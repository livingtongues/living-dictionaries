import type { RequestHandler } from './$types'
import type { Database } from 'better-sqlite3'
import type {
  ConversationMessageRow,
  ConversationRow,
  ThreadArtifactRow,
  ThreadQuestionRow,
} from '$lib/db/server/import-conversations'
import type { SourceFileRow } from '$lib/db/server/source-files'
import { ResponseCodes } from '$lib/constants'
import {
  list_artifacts,
  list_conversation_messages,
  list_questions,
  set_conversation_resolved,
  start_conversation,
} from '$lib/db/server/import-conversations'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { is_team_actor, require_conversation, require_team } from '$lib/import/server/conversation-access'
import { error, json } from '@sveltejs/kit'

/** Display identity for one person in the conversation. */
export interface ConversationPerson {
  user_id: string | null
  name: string | null
  email: string | null
  is_team: boolean
}

export interface ConversationMessageForClient extends ConversationMessageRow {
  author: ConversationPerson
}

export interface V1ConversationGetResponseBody {
  conversation: ConversationRow
  messages: ConversationMessageForClient[]
  resources: SourceFileRow[]
  artifacts: ThreadArtifactRow[]
  questions: ThreadQuestionRow[]
  /** True for site admins — unlocks the state controls + the Copy job brief button. */
  is_team: boolean
  /** Uploaded resources are permanent history once the team has started. */
  is_frozen: boolean
}

export interface V1ConversationPatchRequestBody {
  /** Stamp `started_at` (guide Phase 0). Idempotent; freezes the resources. */
  started?: true
  resolved?: boolean
}

export interface V1ConversationPatchResponseBody {
  conversation: ConversationRow
}

function people({ db, user_ids }: { db: Database, user_ids: string[] }): Map<string, ConversationPerson> {
  const map = new Map<string, ConversationPerson>()
  if (!user_ids.length)
    return map
  const placeholders = user_ids.map(() => '?').join(', ')
  const rows = db.prepare(`SELECT id, name, email FROM users WHERE id IN (${placeholders})`)
    .all(...user_ids) as { id: string, name: string | null, email: string | null }[]
  for (const row of rows)
    map.set(row.id, { user_id: row.id, name: row.name, email: row.email, is_team: false })
  return map
}

/** GET a whole conversation — messages, the resources it covers, artifacts, questions. */
export const GET: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const conversation = require_conversation({ db, dictionary_id: dictionary.id, thread_id: event.params.thread_id })

  const rows = list_conversation_messages({ db, thread_id: conversation.id })
  const directory = people({ db, user_ids: [...new Set(rows.map(row => row.author_user_id).filter((id): id is string => !!id))] })
  const messages = rows.map(row => ({
    ...row,
    author: row.author_user_id
      ? directory.get(row.author_user_id) ?? { user_id: row.author_user_id, name: null, email: null, is_team: row.author_kind !== 'customer' }
      : { user_id: null, name: null, email: null, is_team: true },
  })).map(message => ({
    ...message,
    // `author_kind` is the authoritative side marker: 'customer' is always the
    // manager side, 'admin'/'agent' is always ours.
    author: { ...message.author, is_team: message.author_kind !== 'customer' },
  }))

  const resources = db.prepare('SELECT * FROM source_files WHERE import_thread_id = ? AND dictionary_id = ? ORDER BY created_at')
    .all(conversation.id, dictionary.id) as SourceFileRow[]

  return json({
    conversation,
    messages,
    resources,
    artifacts: list_artifacts({ db, thread_id: conversation.id }),
    questions: list_questions({ db, thread_id: conversation.id }),
    is_team: is_team_actor({ db, access }),
    is_frozen: !!conversation.started_at,
  } satisfies V1ConversationGetResponseBody)
}

/** PATCH the conversation's state — start (freeze) and resolve. Team only. */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const conversation = require_conversation({ db, dictionary_id: dictionary.id, thread_id: event.params.thread_id })
  require_team({ db, access })

  const body = await event.request.json() as V1ConversationPatchRequestBody
  if (!('started' in body) && !('resolved' in body))
    error(ResponseCodes.BAD_REQUEST, 'started or resolved is required')

  if (body.started)
    start_conversation({ db, thread_id: conversation.id, user_id: access.user_id })
  if ('resolved' in body)
    set_conversation_resolved({ db, thread_id: conversation.id, user_id: access.user_id, resolved: !!body.resolved })

  return json({
    conversation: require_conversation({ db, dictionary_id: dictionary.id, thread_id: conversation.id }),
  } satisfies V1ConversationPatchResponseBody)
}
