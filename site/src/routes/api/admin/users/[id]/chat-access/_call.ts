import type { AdminUserChatAccessRequestBody, AdminUserChatAccessResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_user_chat_access(user_id: string, body: AdminUserChatAccessRequestBody) {
  return await post_request<AdminUserChatAccessRequestBody, AdminUserChatAccessResponseBody>(
    `/api/admin/users/${user_id}/chat-access`,
    body,
  )
}
