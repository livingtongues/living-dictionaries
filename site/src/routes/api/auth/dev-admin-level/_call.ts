import type { DevAdminLevelRequestBody, DevAdminLevelResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_dev_admin_level(body: DevAdminLevelRequestBody) {
  return await post_request<DevAdminLevelRequestBody, DevAdminLevelResponseBody>('/api/auth/dev-admin-level', body)
}
