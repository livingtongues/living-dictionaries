import type { AdminAnalyticsResponseBody } from './+server'
import type { AdminAnalyticsRecomputeResponseBody } from './recompute/+server'
import { get_request, post_request } from '$lib/utils/requests'

export async function api_admin_analytics({ fetch, audience }: { fetch?: typeof globalThis.fetch, audience?: 'humans' | 'bots' } = {}) {
  const params = new URLSearchParams()
  if (audience === 'bots')
    params.set('audience', 'bots')
  const query = params.toString()
  return await get_request<AdminAnalyticsResponseBody>(`/api/admin/analytics${query ? `?${query}` : ''}`, { fetch })
}

/** Fork the niced child now (the dashboards' Recompute button). Returns as soon as it's spawned. */
export async function api_admin_analytics_recompute() {
  return await post_request<Record<string, never>, AdminAnalyticsRecomputeResponseBody>(`/api/admin/analytics/recompute`, {})
}
