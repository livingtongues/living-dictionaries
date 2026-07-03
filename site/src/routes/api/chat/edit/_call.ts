import type { ChatEditRequestBody, ChatEditResponse } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_edit(body: ChatEditRequestBody) {
  return await post_request<ChatEditRequestBody, ChatEditResponse>('/api/chat/edit', body)
}
