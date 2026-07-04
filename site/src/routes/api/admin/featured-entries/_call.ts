import type { FeaturedEntryStatus } from '$lib/db/server/featured-entries'
import type { AdminFeaturedEntriesRequestBody, AdminFeaturedEntriesResponseBody, AdminFeaturedEntriesUpdateResponseBody } from './+server'
import { get_request, post_request } from '$lib/utils/requests'

export async function api_admin_featured_entries_list(options?: { status?: FeaturedEntryStatus, fetch?: typeof fetch }) {
  const query = options?.status ? `?status=${options.status}` : ''
  return await get_request<AdminFeaturedEntriesResponseBody>(`/api/admin/featured-entries${query}`, options)
}

export async function api_admin_featured_entries_set_status(body: AdminFeaturedEntriesRequestBody) {
  return await post_request<AdminFeaturedEntriesRequestBody, AdminFeaturedEntriesUpdateResponseBody>('/api/admin/featured-entries', body)
}
