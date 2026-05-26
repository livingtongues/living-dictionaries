import type { MessagesReplyRequestBody, MessagesReplyResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_messages_reply(body: MessagesReplyRequestBody) {
  return await post_request<MessagesReplyRequestBody, MessagesReplyResponseBody>(
    '/api/messages/reply',
    body,
  )
}
