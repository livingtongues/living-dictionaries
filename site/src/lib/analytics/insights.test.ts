import type { LogAnalytics } from '$lib/db/server/log-analytics'
import { log_insights } from './insights'

type Daily = LogAnalytics['daily']

function make_daily(sessions_per_day: number[]): Daily {
  return sessions_per_day.map((sessions, index) => ({
    day: new Date(Date.UTC(2026, 5, 1 + index)).toISOString().slice(0, 10),
    sessions,
    users: 0,
    errors: 0,
    logs: 0,
  }))
}

function make_analytics(overrides: Partial<LogAnalytics> = {}): LogAnalytics {
  return {
    window_days: 30,
    generated_at: '2026-06-24T00:00:00.000Z',
    daily: [],
    totals: { sessions: 0, errors: 0, logs: 0, unique_users: 0 },
    top_routes: [],
    top_events: [],
    by_source: [],
    recent_errors: [],
    browsers: [],
    capability: { total_sessions: 0, below_capability_sessions: 0, bot_sessions: 0, db_tiers: [] },
    performance: { summary: [], daily: [] },
    geo: { located_sessions: 0, areas: [], ttfb_by_country: [], ttfb_by_distance: [] },
    ...overrides,
  }
}

describe(log_insights, () => {
  test('computes rates and depth from totals', () => {
    const result = log_insights({
      analytics: make_analytics({ totals: { logs: 2000, errors: 20, sessions: 200, unique_users: 80 }, window_days: 10 }),
    })
    expect(result.error_rate).toBe(0.01)
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
