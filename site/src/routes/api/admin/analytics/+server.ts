/**
 * GET → live log analytics for `/admin/analytics`. Reads `client_logs` + the
 * `log_daily_metrics` rollup straight from the server `shared.db` (operator data,
 * NOT the local-first wa-sqlite). Admin-gated. Loaded by the page's `+page.ts`
 * via `get_request` (cookie auth rides along automatically).
 */
import type { RequestHandler } from './$types'
import type { LogAnalytics } from '$lib/db/server/log-analytics'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_log_analytics } from '$lib/db/server/log-analytics'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

export interface AdminAnalyticsResponseBody {
  analytics: LogAnalytics
}

export const GET: RequestHandler = async (event) => {
  const auth = await verify_auth(event)
  if (!is_admin(auth.email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const audience = event.url.searchParams.get('audience') === 'bots' ? 'bots' : 'humans'
  const analytics = get_log_analytics({ shared_db: get_shared_db(), days: 30, audience })
  return json({ analytics } satisfies AdminAnalyticsResponseBody)
}
