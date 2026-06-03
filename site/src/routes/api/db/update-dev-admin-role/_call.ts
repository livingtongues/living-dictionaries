import type { UpdateDevAdminRoleRequestBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function api_update_dev_admin_role(body: UpdateDevAdminRoleRequestBody) {
  return await post_request<UpdateDevAdminRoleRequestBody, null>(`/api/db/update-dev-admin-role`, body)
}
