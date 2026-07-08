import type { ChatReactRequestBody, ChatReactResponse } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_react(body: ChatReactRequestBody) {
  return await post_request<ChatReactRequestBody, ChatReactResponse>('/api/chat/react', body)
}
