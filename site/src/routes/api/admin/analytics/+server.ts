/**
 * GET → live log analytics for `/admin/analytics`. Reads raw `client_logs` from
 * the server-only `logs.db` + the `log_daily_metrics` / `log_daily_sessions`
 * rollups from `shared.db` (operator data, NOT the local-first wa-sqlite).
 * Admin-gated. Loaded by the page's `+page.ts` via `get_request` (cookie auth
 * rides along automatically). Uses default DB handles so the 15-min cache applies.
 */
import type { RequestHandler } from './$types'
import type { DeployMetric } from '$lib/db/server/deploy-metrics'
import type { LogAnalytics } from '$lib/db/server/log-analytics'
import { is_admin, is_admin_at_least } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { read_deploy_metrics } from '$lib/db/server/deploy-metrics'
import { build_host_stats, get_log_analytics } from '$lib/db/server/log-analytics'
import { get_logs_db } from '$lib/db/server/logs-db'
import { error, json } from '@sveltejs/kit'

export interface AdminAnalyticsResponseBody {
  analytics: LogAnalytics & { deploy_metrics: DeployMetric[] }
}

export const GET: RequestHandler = async (event) => {
  const auth = await verify_auth(event)
  if (!is_admin(auth.email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const audience = event.url.searchParams.get('audience') === 'bots' ? 'bots' : 'humans'
  const analytics = get_log_analytics({ days: 30, audience })
  // Host resources are injected OUTSIDE the cached analytics blob (the live
  // /proc reading must stay fresh) and only for level-3 (super) admins — VPS
  // capacity is operator data, not a level-2 concern.
  const is_super_admin = is_admin_at_least(auth.email, 3)
  const host = is_super_admin ? build_host_stats({ logs_db: get_logs_db() }) : null
  // Deploy history (deploy-metrics.jsonl written by this box's deploy.sh) — same
  // operator-data gate as host, injected outside the cached blob.
  const deploy_metrics = is_super_admin ? read_deploy_metrics() : []
  return json({ analytics: { ...analytics, host, deploy_metrics } } satisfies AdminAnalyticsResponseBody)
}
