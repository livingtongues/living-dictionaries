import type { ChatChannelsRequestBody, ChatChannelsResponse } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_channels(body: ChatChannelsRequestBody) {
  return await post_request<ChatChannelsRequestBody, ChatChannelsResponse>('/api/chat/channels', body)
}
