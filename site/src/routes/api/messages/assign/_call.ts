import type { MessagesAssignRequestBody, MessagesAssignResponseBody } from './+server.js'
import { post_request } from '$lib/utils/requests'

export async function api_messages_assign(body: MessagesAssignRequestBody) {
  return await post_request<MessagesAssignRequestBody, MessagesAssignResponseBody>(
    '/api/messages/assign',
    body,
  )
}
