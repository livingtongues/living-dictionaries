import type { AdminSyncRequestBody, AdminSyncResponseBody } from './+server.js'
import { post_request } from '$lib/utils/requests'

export async function api_admin_sync(body: AdminSyncRequestBody) {
  return await post_request<AdminSyncRequestBody, AdminSyncResponseBody>('/api/admin-sync', body)
}
