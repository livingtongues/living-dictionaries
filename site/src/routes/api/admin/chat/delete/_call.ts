import type { AdminChatDeleteRequestBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_chat_delete(body: AdminChatDeleteRequestBody) {
  return await post_request<AdminChatDeleteRequestBody, { ok: true }>('/api/admin/chat/delete', body)
}
