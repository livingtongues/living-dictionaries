import type { LogAnalytics } from '$lib/db/server/log-analytics'
import { log_insights } from './insights'

type Daily = LogAnalytics['daily']

function make_daily(sessions_per_day: number[]): Daily {
  return sessions_per_day.map((sessions, index) => ({
    day: new Date(Date.UTC(2026, 5, 1 + index)).toISOString().slice(0, 10),
    sessions,
    users: 0,
    errors: 0,
    real_errors: 0,
    stale_errors: 0,
    logs: 0,
  }))
}

function make_analytics(overrides: Partial<LogAnalytics> = {}): LogAnalytics {
  return {
    audience: 'humans',
    window_days: 30,
    generated_at: '2026-06-24T00:00:00.000Z',
    daily: [],
    deploys: [],
    totals: { sessions: 0, errors: 0, real_errors: 0, stale_errors: 0, logs: 0, unique_users: 0 },
    top_routes: [],
    top_events: [],
    by_source: [],
    error_clusters: [],
    capability: { total_sessions: 0, below_capability_sessions: 0, bot_sessions: 0, webdriver_sessions: 0, devices: [], os: [], browsers: [], db_tiers: [] },
    performance: { summary: [], daily: [], by_route: [] },
    web_vitals: [],
    geo: { located_sessions: 0, areas: [], ttfb_by_country: [], ttfb_by_distance: [] },
    errors_by_version: { current_version: null, total: 0, current: 0, stale: 0, stale_pct: null, versions: [] },
    pipeline: { last_log_at: null, last_session_start_at: null, last_server_log_at: null, retention_ran_at: null, hot_rows: 0, archived_rows: 0, missing_syncable_tables: [] },
    server_faults: { total: 0, schema_drift_count: 0, clusters: [] },
    event_coverage: { events: [], never_emitted: 0 },
    leader_health: { timeouts: 0, recovered: 0, failed: 0, failed_no_leader: 0, failed_by_source: [], failed_by_code: [], failed_current: 0, failed_stale: 0 },
    api_v1: { total: 0, failures: 0, daily: [], by_event: [], by_dictionary: [], by_via: [] },
    missing_i18n_keys: { total: 0, distinct_keys: 0, sessions: 0, keys: [] },
    boot_health: { failed_sessions: 0, recovered_sessions: 0, non_recovery_pct: null, snapshot_expired_sessions: 0, by_message: [], daily: [] },
    uptime: { probes: 0, availability: null, ttfb: { p50: null, p95: null }, total: { p50: null, p95: null }, vantages: [], daily: [] },
    ...overrides,
  }
}

describe(log_insights, () => {
  test('computes rates and depth from totals (error_rate uses real_errors, not raw errors)', () => {
    const result = log_insights({
      // 20 raw error rows but only 10 real faults (10 known-noise) → rate is 10/2000.
      analytics: make_analytics({ totals: { logs: 2000, errors: 20, real_errors: 10, stale_errors: 0, sessions: 200, unique_users: 80 }, window_days: 10 }),
    })
    expect(result.error_rate).toBe(0.005)
    expect(result.sessions_per_day).toBe(20)
    expect(result.logs_per_session).toBe(10)
  })

  test('returns null for rates when denominators are zero', () => {
    const result = log_insights({ analytics: make_analytics() })
    expect(result.error_rate).toBe(null)
    expect(result.logs_per_session).toBe(null)
    expect(result.busiest_day).toBe(null)
    expect(result.wow_change).toBe(null)
  })

  test('picks the single highest-volume day', () => {
    const daily = make_daily([0, 0, 0])
    daily[0].logs = 40
    daily[1].logs = 90
    daily[2].logs = 12
    const result = log_insights({ analytics: make_analytics({ daily }) })
    expect(result.busiest_day).toEqual({ day: daily[1].day, logs: 90 })
  })

  test('computes week-over-week session change', () => {
    // prior 7 = 70 sessions, last 7 = 140 → +100%.
    const result = log_insights({ analytics: make_analytics({ daily: make_daily([10, 10, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 20, 20]) }) })
    expect(result.wow_change).toBe(1)
  })

  test('hides week-over-week with fewer than 14 days', () => {
    const result = log_insights({ analytics: make_analytics({ daily: make_daily(Array.from({ length: 13 }, () => 5)) }) })
    expect(result.wow_change).toBe(null)
  })

  test('hides week-over-week when the prior week had no sessions', () => {
    const result = log_insights({ analytics: make_analytics({ daily: make_daily([0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5, 5]) }) })
    expect(result.wow_change).toBe(null)
  })
})
