import type { ChatSendRequestBody, ChatSendResponse } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_send(body: ChatSendRequestBody) {
  return await post_request<ChatSendRequestBody, ChatSendResponse>('/api/chat/send', body)
}
