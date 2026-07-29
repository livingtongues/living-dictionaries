import type { RequestHandler } from './$types'
import type { NewQuestion, QuestionOption, ThreadQuestionRow } from '$lib/db/server/import-conversations'
import type { EntriesQuery } from '$lib/search/entries-query-link'
import { ResponseCodes } from '$lib/constants'
import { create_questions, list_questions } from '$lib/db/server/import-conversations'
import { parse_entries_query } from '$lib/search/entries-query-link'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { require_conversation, require_team } from '$lib/import/server/conversation-access'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

const QUESTION_KINDS = ['text', 'choice', 'multi_choice'] as const

export interface V1ConversationQuestionsPostRequestBody {
  questions: {
    /** `text` for open prose; `choice`/`multi_choice` when the useful answers are enumerable. */
    kind: 'text' | 'choice' | 'multi_choice'
    title: string
    /** A sentence or two of context. Keep the long form (examples, entry links) in the report. */
    body_html?: string
    options?: QuestionOption[]
    /** Fragment id inside the report artifact, e.g. `#q-raised-dot`. */
    report_anchor?: string
    /**
     * The entries this question is about, as an entries-view filter — rendered
     * as a "show me these entries" button so the manager answers from the rows
     * instead of from memory. e.g. `{ sources: ['smith-1979'], no_audio: true }`.
     */
    entries_query?: EntriesQuery
    /** Your own wording for that button, e.g. "Show me these 1,191 entries". */
    entries_query_label?: string
  }[]
}

export interface V1ConversationQuestionsPostResponseBody {
  questions: ThreadQuestionRow[]
}

export interface V1ConversationQuestionsGetResponseBody {
  questions: ThreadQuestionRow[]
}

export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const conversation = require_conversation({ db, dictionary_id: dictionary.id, thread_id: event.params.thread_id })
  return json({ questions: list_questions({ db, thread_id: conversation.id }) } satisfies V1ConversationQuestionsGetResponseBody)
}

/**
 * POST the questions an import raised, as answerable objects. Appended after any
 * existing ones, so a job can file a second round without renumbering the first.
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const conversation = require_conversation({ db, dictionary_id: dictionary.id, thread_id: event.params.thread_id })
  require_team({ db, access })

  const body = await event.request.json() as Partial<V1ConversationQuestionsPostRequestBody>
  const incoming = Array.isArray(body.questions) ? body.questions : []
  if (!incoming.length)
    error(ResponseCodes.BAD_REQUEST, 'questions is required')

  const questions: NewQuestion[] = incoming.map((question, index) => {
    if (!QUESTION_KINDS.includes(question.kind))
      error(ResponseCodes.BAD_REQUEST, `questions[${index}].kind must be one of ${QUESTION_KINDS.join(', ')}`)
    if (!question.title?.trim())
      error(ResponseCodes.BAD_REQUEST, `questions[${index}].title is required`)
    const options = question.options?.filter(option => option?.value && option?.label) ?? []
    if (question.kind !== 'text' && options.length < 2)
      error(ResponseCodes.BAD_REQUEST, `questions[${index}] is a ${question.kind} question, so it needs at least two options`)
    // A filter typo must be REJECTED, never ignored: a button that shows the
    // manager the wrong set of entries is worse than no button at all.
    let entries_query: string | null = null
    if (question.entries_query !== undefined && question.entries_query !== null) {
      const parsed = parse_entries_query(question.entries_query)
      if (parsed.error)
        error(ResponseCodes.BAD_REQUEST, `questions[${index}]: ${parsed.error}`)
      entries_query = JSON.stringify(parsed.entries_query)
    }
    return {
      kind: question.kind,
      title: question.title.trim(),
      body_html: question.body_html?.trim() || null,
      options: question.kind === 'text' ? null : options,
      report_anchor: question.report_anchor?.trim() || null,
      entries_query,
      entries_query_label: entries_query ? question.entries_query_label?.trim() || null : null,
    }
  })

  const created = create_questions({
    db,
    thread_id: conversation.id,
    dictionary_id: dictionary.id,
    questions,
    created_by_user_id: access.user_id,
  })
  log_server_event({ level: 'info', message: 'import_questions_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, thread_id: conversation.id, count: created.length, via: access.via } })
  return json({ questions: created } satisfies V1ConversationQuestionsPostResponseBody)
}
