import type { AdminChatSendRequestBody, AdminChatSendResponse } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_chat_send(body: AdminChatSendRequestBody) {
  return await post_request<AdminChatSendRequestBody, AdminChatSendResponse>('/api/admin/chat/send', body)
}
