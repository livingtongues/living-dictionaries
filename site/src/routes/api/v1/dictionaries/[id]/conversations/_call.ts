import type { V1ConversationsGetResponseBody } from './+server'
import type {
  V1ConversationGetResponseBody,
  V1ConversationPatchRequestBody,
  V1ConversationPatchResponseBody,
} from './[thread_id]/+server'
import type { V1ConversationArtifactsPostRequestBody, V1ConversationArtifactsPostResponseBody } from './[thread_id]/artifacts/+server'
import type { V1ConversationBriefGetResponseBody } from './[thread_id]/brief/+server'
import type { V1ConversationMessagesPostRequestBody, V1ConversationMessagesPostResponseBody } from './[thread_id]/messages/+server'
import type { V1ConversationQuestionsPostRequestBody, V1ConversationQuestionsPostResponseBody } from './[thread_id]/questions/+server'
import type { V1ConversationQuestionPatchRequestBody, V1ConversationQuestionPatchResponseBody } from './[thread_id]/questions/[question_id]/+server'
import type { V1ConversationReadPostResponseBody } from './[thread_id]/read/+server'
import type { V1ConversationWithdrawPostResponseBody } from './[thread_id]/withdraw/+server'
import { get_request, patch_request, post_request } from '$lib/utils/requests'

/** Session-cookie clients (the import pages + /admin/imports). Agents hit the same routes with a Bearer key. */

function base({ dictionary_id, thread_id }: { dictionary_id: string, thread_id?: string }): string {
  const root = `/api/v1/dictionaries/${dictionary_id}/conversations`
  return thread_id ? `${root}/${thread_id}` : root
}

export async function api_conversations_list({ dictionary_id }: { dictionary_id: string }) {
  return await get_request<V1ConversationsGetResponseBody>(base({ dictionary_id }))
}

export async function api_conversation_get({ dictionary_id, thread_id }: { dictionary_id: string, thread_id: string }) {
  return await get_request<V1ConversationGetResponseBody>(base({ dictionary_id, thread_id }))
}

export async function api_conversation_update({ dictionary_id, thread_id, ...body }: { dictionary_id: string, thread_id: string } & V1ConversationPatchRequestBody) {
  return await patch_request<V1ConversationPatchRequestBody, V1ConversationPatchResponseBody>(base({ dictionary_id, thread_id }), body)
}

export async function api_conversation_post_message({ dictionary_id, thread_id, ...body }: { dictionary_id: string, thread_id: string } & V1ConversationMessagesPostRequestBody) {
  return await post_request<V1ConversationMessagesPostRequestBody, V1ConversationMessagesPostResponseBody>(`${base({ dictionary_id, thread_id })}/messages`, body)
}

export async function api_conversation_mark_read({ dictionary_id, thread_id }: { dictionary_id: string, thread_id: string }) {
  return await post_request<Record<string, never>, V1ConversationReadPostResponseBody>(`${base({ dictionary_id, thread_id })}/read`, {})
}

export async function api_conversation_withdraw({ dictionary_id, thread_id }: { dictionary_id: string, thread_id: string }) {
  return await post_request<Record<string, never>, V1ConversationWithdrawPostResponseBody>(`${base({ dictionary_id, thread_id })}/withdraw`, {})
}

export async function api_conversation_add_artifact({ dictionary_id, thread_id, ...body }: { dictionary_id: string, thread_id: string } & V1ConversationArtifactsPostRequestBody) {
  return await post_request<V1ConversationArtifactsPostRequestBody, V1ConversationArtifactsPostResponseBody>(`${base({ dictionary_id, thread_id })}/artifacts`, body)
}

export function conversation_artifact_url({ dictionary_id, thread_id, artifact_id, download }: {
  dictionary_id: string
  thread_id: string
  artifact_id: string
  download?: boolean
}): string {
  return `${base({ dictionary_id, thread_id })}/artifacts/${artifact_id}${download ? '?download' : ''}`
}

export async function api_conversation_add_questions({ dictionary_id, thread_id, ...body }: { dictionary_id: string, thread_id: string } & V1ConversationQuestionsPostRequestBody) {
  return await post_request<V1ConversationQuestionsPostRequestBody, V1ConversationQuestionsPostResponseBody>(`${base({ dictionary_id, thread_id })}/questions`, body)
}

export async function api_conversation_answer_question({ dictionary_id, thread_id, question_id, ...body }: { dictionary_id: string, thread_id: string, question_id: string } & V1ConversationQuestionPatchRequestBody) {
  return await patch_request<V1ConversationQuestionPatchRequestBody, V1ConversationQuestionPatchResponseBody>(`${base({ dictionary_id, thread_id })}/questions/${question_id}`, body)
}

export async function api_conversation_brief({ dictionary_id, thread_id }: { dictionary_id: string, thread_id: string }) {
  return await get_request<V1ConversationBriefGetResponseBody>(`${base({ dictionary_id, thread_id })}/brief`)
}
