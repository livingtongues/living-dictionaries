import type { AdminAnalyticsResponseBody } from './+server'
import { get_request } from '$lib/utils/requests'

export async function api_admin_analytics({ fetch, audience }: { fetch?: typeof globalThis.fetch, audience?: 'humans' | 'bots' } = {}) {
  const query = audience === 'bots' ? '?audience=bots' : ''
  return await get_request<AdminAnalyticsResponseBody>(`/api/admin/analytics${query}`, { fetch })
}
