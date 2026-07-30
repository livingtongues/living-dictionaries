/**
 * GET → the daily analytics CHECKPOINT for `/admin/analytics` + `/admin/health`.
 *
 * This handler runs NO database queries. It reads one JSON file (written once a day
 * by the niced child process in `analytics-snapshot.ts`), layers a live /proc
 * reading onto the host panel for level-3 admins, and returns. That is the whole
 * request path — the 11–80 s whole-window scan that used to hide behind a
 * stale-while-revalidate memo now happens at 03:30 in a process that is serving
 * nobody (2026-07-30, vps-setup `.issues/analytics-and-cron-simplification.md`).
 *
 * `analytics: null` means "no checkpoint yet" (first deploy of the feature, or the
 * file was pruned): the page renders its own empty state with a Recompute button
 * rather than anything being computed here.
 */
import type { RequestHandler } from './$types'
import type { AnalyticsSnapshot } from '$lib/db/server/analytics-snapshot'
import type { DeployMetric } from '$lib/db/server/deploy-metrics'
import type { HostStats } from '$lib/server/host-stats'
import type { LogAnalytics } from '$lib/db/server/log-analytics'
import { is_admin, is_admin_at_least } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { analytics_snapshot_running, read_analytics_snapshot } from '$lib/db/server/analytics-snapshot'
import { read_deploy_metrics } from '$lib/db/server/deploy-metrics'
import { read_host_stats } from '$lib/server/host-stats'
import { error, json } from '@sveltejs/kit'

export interface AdminAnalyticsResponseBody {
  /** null → nothing computed yet; the page shows its "no checkpoint" state. */
  analytics: (LogAnalytics & { deploy_metrics: DeployMetric[] }) | null
  checkpoint: {
    generated_at: string | null
    computed_ms: number | null
    /** What kicked the last checkpoint: `cron` | `boot-catchup` | `manual`. */
    reason: string | null
    /** A child is computing RIGHT NOW — the page says so after a Recompute. */
    running: boolean
  }
}

export const GET: RequestHandler = async (event) => {
  const auth = await verify_auth(event)
  if (!is_admin(auth.email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const audience = event.url.searchParams.get('audience') === 'bots' ? 'bots' : 'humans'
  const snapshot: AnalyticsSnapshot | null = read_analytics_snapshot({ range: '30', audience })
  const checkpoint = {
    generated_at: snapshot?.generated_at ?? null,
    computed_ms: snapshot?.computed_ms ?? null,
    reason: snapshot?.reason ?? null,
    running: analytics_snapshot_running(),
  }
  if (!snapshot)
    return json({ analytics: null, checkpoint } satisfies AdminAnalyticsResponseBody)

  // VPS capacity + deploy history are operator data, not a level-2 concern.
  const is_super_admin = is_admin_at_least(auth.email, 3)
  const deploy_metrics = is_super_admin ? read_deploy_metrics() : []
  const host = is_super_admin && snapshot.payload.host
    // `now` is the one live number on these pages: a /proc read, no database.
    ? { ...snapshot.payload.host, now: read_host_stats_or_null() }
    : null
  return json({
    analytics: { ...snapshot.payload, host, deploy_metrics },
    checkpoint,
  } satisfies AdminAnalyticsResponseBody)
}

function read_host_stats_or_null(): HostStats | null {
  try {
    return read_host_stats({ tracker: 'health-request' })
  } catch {
    return null // /proc unavailable (non-Linux dev) — the panel falls back to the logged sample
  }
}
