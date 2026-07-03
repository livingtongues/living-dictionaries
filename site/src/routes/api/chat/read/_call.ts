import type { ChatReadRequestBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_read(body: ChatReadRequestBody) {
  return await post_request<ChatReadRequestBody, { ok: true }>('/api/chat/read', body)
}
