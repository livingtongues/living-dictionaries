import type { AdminChatReadRequestBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_chat_read(body: AdminChatReadRequestBody) {
  return await post_request<AdminChatReadRequestBody, { ok: true }>('/api/admin/chat/read', body)
}
