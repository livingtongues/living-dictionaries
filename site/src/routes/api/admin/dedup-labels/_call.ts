import type { AdminDedupLabelsRequestBody, AdminDedupLabelsResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_dedup_labels(body: AdminDedupLabelsRequestBody) {
  return await post_request<AdminDedupLabelsRequestBody, AdminDedupLabelsResponseBody>('/api/admin/dedup-labels', body)
}
