import type { ChatDeleteRequestBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_delete(body: ChatDeleteRequestBody) {
  return await post_request<ChatDeleteRequestBody, { ok: true }>('/api/chat/delete', body)
}
