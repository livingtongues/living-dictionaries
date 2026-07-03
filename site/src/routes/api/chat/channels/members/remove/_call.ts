import type { ChatChannelsMembersRemoveRequestBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_channels_members_remove(body: ChatChannelsMembersRemoveRequestBody) {
  return await post_request<ChatChannelsMembersRemoveRequestBody, { ok: true }>('/api/chat/channels/members/remove', body)
}
