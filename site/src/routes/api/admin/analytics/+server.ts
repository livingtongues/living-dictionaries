/**
 * GET → live log analytics for `/admin/analytics`. Reads raw `client_logs` from
 * the server-only `logs.db` + the `log_daily_metrics` / `log_daily_sessions`
 * rollups from `shared.db` (operator data, NOT the local-first wa-sqlite).
 * Admin-gated. Loaded by the page's `+page.ts` via `get_request` (cookie auth
 * rides along automatically). Uses default DB handles so the 15-min cache applies.
 */
import type { RequestHandler } from './$types'
import type { LogAnalytics } from '$lib/db/server/log-analytics'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_log_analytics } from '$lib/db/server/log-analytics'
import { error, json } from '@sveltejs/kit'

export interface AdminAnalyticsResponseBody {
  analytics: LogAnalytics
}

export const GET: RequestHandler = async (event) => {
  const auth = await verify_auth(event)
  if (!is_admin(auth.email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const audience = event.url.searchParams.get('audience') === 'bots' ? 'bots' : 'humans'
  const analytics = get_log_analytics({ days: 30, audience })
  return json({ analytics } satisfies AdminAnalyticsResponseBody)
}
