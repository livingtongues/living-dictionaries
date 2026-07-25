import type { RequestHandler } from './$types'
import type { QuestionOption, ThreadQuestionRow } from '$lib/db/server/import-conversations'
import { ResponseCodes } from '$lib/constants'
import { notify_conversation_activity } from '$lib/db/server/import-conversation-notify'
import {
  answer_question,
  get_question,
  post_conversation_message,
} from '$lib/db/server/import-conversations'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { author_kind_for, require_conversation } from '$lib/import/server/conversation-access'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1ConversationQuestionPatchRequestBody {
  /** Free-text answer. Empty/whitespace clears it and reopens the question. */
  answer_text?: string | null
  /** Selected option values for a choice / multi_choice question. */
  answer_values?: string[] | null
  /** Team only — park a question without an answer. */
  status?: 'closed' | 'open'
}

export interface V1ConversationQuestionPatchResponseBody {
  question: ThreadQuestionRow
}

function label_for({ question, values }: { question: ThreadQuestionRow, values: string[] }): string {
  const options = question.options_json ? JSON.parse(question.options_json) as QuestionOption[] : []
  return values.map(value => options.find(option => option.value === value)?.label ?? value).join(', ')
}

/**
 * PATCH an answer. The answer is ALSO mirrored into the conversation as an
 * ordinary message, so the timeline reads as one continuous exchange and the
 * usual notification fan-out tells us it arrived.
 */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const db = get_shared_db()
  const conversation = require_conversation({ db, dictionary_id: dictionary.id, thread_id: event.params.thread_id })

  const question = event.params.question_id ? get_question({ db, question_id: event.params.question_id }) : null
  if (!question || question.thread_id !== conversation.id)
    error(ResponseCodes.NOT_FOUND, 'question not found')

  const body = await event.request.json() as V1ConversationQuestionPatchRequestBody
  const author_kind = author_kind_for({ db, access })

  if (body.status) {
    if (author_kind === 'customer')
      error(ResponseCodes.FORBIDDEN, 'Only the Living Dictionaries team can close a question')
    db.prepare('UPDATE thread_questions SET status = ?, updated_at = ? WHERE id = ?')
      .run(body.status, new Date().toISOString(), question.id)
    return json({ question: get_question({ db, question_id: question.id }) as ThreadQuestionRow } satisfies V1ConversationQuestionPatchResponseBody)
  }

  if (!('answer_text' in body) && !('answer_values' in body))
    error(ResponseCodes.BAD_REQUEST, 'answer_text, answer_values, or status is required')

  const values = body.answer_values?.filter(value => typeof value === 'string' && value) ?? null
  if (values?.length && question.kind === 'text')
    error(ResponseCodes.BAD_REQUEST, 'This is a free-text question — send answer_text')
  if (values && values.length > 1 && question.kind === 'choice')
    error(ResponseCodes.BAD_REQUEST, 'This question takes a single choice')

  const answered = answer_question({
    db,
    question_id: question.id,
    answer_text: body.answer_text ?? null,
    answer_values: values,
    answered_by_user_id: access.user_id,
  })
  if (!answered)
    error(ResponseCodes.NOT_FOUND, 'question not found')

  if (answered.status === 'answered') {
    const spoken = [values?.length ? label_for({ question: answered, values }) : '', answered.answer_text ?? '']
      .filter(Boolean)
      .join(' — ')
    const message_row_id = post_conversation_message({
      db,
      thread_id: conversation.id,
      user_id: access.user_id,
      author_kind,
      body_text: `Answered "${answered.title}": ${spoken}`,
    })
    void notify_conversation_activity({
      db,
      conversation,
      dictionary_name: dictionary.name,
      dictionary_url: dictionary.url,
      author_user_id: access.user_id,
      message_row_id,
      body_text: `Answered "${answered.title}": ${spoken}`,
      base_url: event.url.origin,
    })
  }

  log_server_event({ level: 'info', message: 'import_question_answered', user_id: access.user_id, context: { dictionary_id: dictionary.id, thread_id: conversation.id, question_id: question.id, status: answered.status, via: access.via } })
  return json({ question: answered } satisfies V1ConversationQuestionPatchResponseBody)
}
