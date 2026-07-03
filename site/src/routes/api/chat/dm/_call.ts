import type { ChatDmRequestBody, ChatDmResponse } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_dm(body: ChatDmRequestBody) {
  return await post_request<ChatDmRequestBody, ChatDmResponse>('/api/chat/dm', body)
}
