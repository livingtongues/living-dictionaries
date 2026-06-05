import type { AdminUserUnsubscribeRequestBody, AdminUserUnsubscribeResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_user_unsubscribe(user_id: string, body: AdminUserUnsubscribeRequestBody) {
  return await post_request<AdminUserUnsubscribeRequestBody, AdminUserUnsubscribeResponseBody>(
    `/api/admin/users/${user_id}/unsubscribe`,
    body,
  )
}
