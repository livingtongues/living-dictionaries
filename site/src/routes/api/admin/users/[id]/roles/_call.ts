import type { AdminUserRolesRequestBody, AdminUserRolesResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_user_roles(user_id: string, body: AdminUserRolesRequestBody) {
  return await post_request<AdminUserRolesRequestBody, AdminUserRolesResponseBody>(
    `/api/admin/users/${user_id}/roles`,
    body,
  )
}
