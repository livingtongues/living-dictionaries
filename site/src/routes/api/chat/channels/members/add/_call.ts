import type { ChatChannelsMembersAddRequestBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_channels_members_add(body: ChatChannelsMembersAddRequestBody) {
  return await post_request<ChatChannelsMembersAddRequestBody, { ok: true }>('/api/chat/channels/members/add', body)
}
