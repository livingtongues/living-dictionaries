import type { ChatChannelsRenameRequestBody, ChatChannelsRenameResponse } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_channels_rename(body: ChatChannelsRenameRequestBody) {
  return await post_request<ChatChannelsRenameRequestBody, ChatChannelsRenameResponse>('/api/chat/channels/rename', body)
}
