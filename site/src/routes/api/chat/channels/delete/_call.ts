import type { ChatChannelsDeleteRequestBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_channels_delete(body: ChatChannelsDeleteRequestBody) {
  return await post_request<ChatChannelsDeleteRequestBody, { ok: true }>('/api/chat/channels/delete', body)
}
