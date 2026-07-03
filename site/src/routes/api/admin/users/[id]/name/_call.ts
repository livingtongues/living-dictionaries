import type { AdminUserNameRequestBody, AdminUserNameResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_user_name(user_id: string, body: AdminUserNameRequestBody) {
  return await post_request<AdminUserNameRequestBody, AdminUserNameResponseBody>(
    `/api/admin/users/${user_id}/name`,
    body,
  )
}
