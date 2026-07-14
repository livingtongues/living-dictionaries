import type { AdminAnalyticsResponseBody } from './+server'
import type { AnalyticsScope } from '$lib/db/server/log-analytics'
import { get_request } from '$lib/utils/requests'

export async function api_admin_analytics({ fetch, audience, scope }: { fetch?: typeof globalThis.fetch, audience?: 'humans' | 'bots', scope?: AnalyticsScope } = {}) {
  const params = new URLSearchParams()
  if (audience === 'bots')
    params.set('audience', 'bots')
  if (scope && scope !== 'full')
    params.set('scope', scope)
  const query = params.toString()
  return await get_request<AdminAnalyticsResponseBody>(`/api/admin/analytics${query ? `?${query}` : ''}`, { fetch })
}
