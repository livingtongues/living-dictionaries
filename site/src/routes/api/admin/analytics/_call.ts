import type { AdminAnalyticsResponseBody } from './+server'
import { get_request } from '$lib/utils/requests'

export async function api_admin_analytics({ fetch }: { fetch?: typeof globalThis.fetch } = {}) {
  return await get_request<AdminAnalyticsResponseBody>('/api/admin/analytics', { fetch })
}
