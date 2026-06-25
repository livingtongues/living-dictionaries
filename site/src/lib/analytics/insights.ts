/**
 * Pure derived-metric math for the /admin/analytics dashboard, mirroring the
 * revenue dashboard's `$lib/revenue/insights.ts` split: this returns raw numbers
 * (nulls where a denominator is missing) and the page formats them with
 * `$lib/constants`. Free of `$env`/server deps — the only import is the
 * (type-erased) `LogAnalytics` shape.
 */
import type { LogAnalytics } from '$lib/db/server/log-analytics'

export interface LogInsights {
  /** errors ÷ logs, as a fraction; null when there are no logs. */
  error_rate: number | null
  /** Average sessions per day across the window; null when the window is empty. */
  sessions_per_day: number | null
  /** logs ÷ sessions (engagement depth); null when there are no sessions. */
  logs_per_session: number | null
  /** The single highest-volume day; null when nothing was logged. */
  busiest_day: { day: string, logs: number } | null
  /** Sessions in the last 7 days vs the prior 7, as a fraction; null if <14 days or prior week was empty. */
  wow_change: number | null
}

export function log_insights({ analytics }: { analytics: LogAnalytics }): LogInsights {
  const { totals, daily, window_days } = analytics

  const error_rate = totals.logs > 0 ? totals.errors / totals.logs : null
  const sessions_per_day = window_days > 0 ? totals.sessions / window_days : null
  const logs_per_session = totals.sessions > 0 ? totals.logs / totals.sessions : null

  let busiest_day: LogInsights['busiest_day'] = null
  for (const point of daily) {
    if (point.logs > 0 && (!busiest_day || point.logs > busiest_day.logs))
      busiest_day = { day: point.day, logs: point.logs }
  }

  let wow_change: number | null = null
  if (daily.length >= 14) {
    const last7 = daily.slice(-7).reduce((sum, point) => sum + point.sessions, 0)
    const prior7 = daily.slice(-14, -7).reduce((sum, point) => sum + point.sessions, 0)
    if (prior7 > 0)
      wow_change = (last7 - prior7) / prior7
  }

  return { error_rate, sessions_per_day, logs_per_session, busiest_day, wow_change }
}
