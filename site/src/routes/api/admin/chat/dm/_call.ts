import type { AdminChatDmRequestBody, AdminChatDmResponse } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_chat_dm(body: AdminChatDmRequestBody) {
  return await post_request<AdminChatDmRequestBody, AdminChatDmResponse>('/api/admin/chat/dm', body)
}
