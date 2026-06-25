import type { AdminChatEditRequestBody, AdminChatEditResponse } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_chat_edit(body: AdminChatEditRequestBody) {
  return await post_request<AdminChatEditRequestBody, AdminChatEditResponse>('/api/admin/chat/edit', body)
}
