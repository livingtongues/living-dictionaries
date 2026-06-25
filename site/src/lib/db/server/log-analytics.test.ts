import type Database from 'better-sqlite3'
import type { RequestGeo } from '$lib/server/geo-from-request'
import { insert_client_log } from '$lib/server/insert-client-log'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { get_log_analytics } from './log-analytics'
import { open_shared_db } from './shared-db'

let db: Database.Database
const NOW = new Date('2026-06-30T12:00:00.000Z')

beforeEach(() => {
  db = open_shared_db(':memory:')
})

afterEach(() => {
  db.close()
})

function add_log({ day, level = 'info', message = 'heartbeat', source = 'client', user_id = null, context = null, user_agent = null, geo }: {
  day: string
  level?: 'error' | 'warn' | 'info' | 'unhandled_rejection' | 'crash'
  message?: string
  source?: 'client' | 'server'
  user_id?: string | null
  context?: Record<string, unknown> | null
  user_agent?: string | null
  geo?: RequestGeo
}): void {
  insert_client_log({ payload: { level, message, context, user_agent }, user_id, source, ...(geo ? { geo } : {}), db, now: new Date(`${day}T10:00:00.000Z`) })
}

describe(get_log_analytics, () => {
  test('builds a zero-filled daily series + window totals from live logs', () => {
    add_log({ day: '2026-06-30', message: 'session_start', user_id: 'u1', context: { session_id: 's1' } })
    add_log({ day: '2026-06-30', message: 'search_performed', user_id: 'u1', context: { session_id: 's1', query: 'jesus' } })
    add_log({ day: '2026-06-30', level: 'error', message: 'boom', context: { session_id: 's1' } })
    add_log({ day: '2026-06-29', message: 'heartbeat', user_id: 'u2', context: { session_id: 's2' } })

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })

    expect(analytics.daily).toHaveLength(30)
    const last_day = analytics.daily[analytics.daily.length - 1]
    const prev_day = analytics.daily[analytics.daily.length - 2]
    expect(last_day?.day).toBe('2026-06-30')
    expect(last_day?.errors).toBe(1)
    expect(last_day?.sessions).toBe(1)
    expect(prev_day?.day).toBe('2026-06-29')
    expect(prev_day?.users).toBe(1)
    // A day with no logs is present and zeroed.
    expect(analytics.daily[0]).toEqual({ day: '2026-06-01', sessions: 0, users: 0, errors: 0, logs: 0 })

    expect(analytics.totals.logs).toBe(4)
    expect(analytics.totals.errors).toBe(1)
    expect(analytics.totals.unique_users).toBe(2)
  })

  test('surfaces analytics events (infra excluded) and normalized route buckets', () => {
    add_log({ day: '2026-06-30', message: 'search_performed', context: { session_id: 's1' } })
    add_log({ day: '2026-06-30', message: 'search_performed', context: { session_id: 's1' } })
    add_log({ day: '2026-06-30', message: 'entry_opened', context: { session_id: 's1' } })
    add_log({ day: '2026-06-30', message: 'navigation', context: { session_id: 's1', to: '/dictionaries' } })
    add_log({ day: '2026-06-30', message: 'navigation', context: { session_id: 's1', to: '/my-dict/entries/x' } })

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })

    const search = analytics.top_events.find(event => event.event === 'search_performed')
    expect(search?.count).toBe(2)
    // Infra events (heartbeat/navigation/etc.) are NOT in the top-events list.
    expect(analytics.top_events.some(event => event.event === 'navigation')).toBeFalsy()

    expect(analytics.top_routes.find(route => route.route === 'dictionaries')?.count).toBe(1)
    expect(analytics.top_routes.find(route => route.route === 'dictionary:entry')?.count).toBe(1)
  })

  test('splits client vs server source and lists recent errors', () => {
    add_log({ day: '2026-06-30', level: 'error', message: 'client-err' })
    add_log({ day: '2026-06-30', level: 'error', message: 'server-err', source: 'server' })

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })

    expect(analytics.by_source.find(s => s.source === 'client')?.errors).toBe(1)
    expect(analytics.by_source.find(s => s.source === 'server')?.errors).toBe(1)
    expect(analytics.recent_errors.map(e => e.message).sort()).toEqual(['client-err', 'server-err'])
  })

  test('browser breakdown excludes bots and flags below-capability sessions', () => {
    const SAFARI17 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    const SAFARI14 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15'
    const APPLEBOT = `${SAFARI17} (Applebot/0.1; +http://www.apple.com/go/applebot)`
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 's1', db_tier: 'opfs-worker' }, user_agent: SAFARI17 })
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 's2' }, user_agent: SAFARI14 })
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 's3' }, user_agent: APPLEBOT })

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })

    expect(analytics.capability.bot_sessions).toBe(1)
    expect(analytics.capability.total_sessions).toBe(2) // bots excluded from human total
    expect(analytics.capability.below_capability_sessions).toBe(1) // Safari 14 < 15.4
    // The Applebot session (parses as Safari 17) must NOT inflate the Safari 17 bucket.
    expect(analytics.browsers.find(browser => browser.label === 'Safari 17')?.sessions).toBe(1)
    expect(analytics.browsers.find(browser => browser.label === 'Safari 14')?.below_capability).toBeTruthy()
    expect(analytics.capability.db_tiers.find(tier => tier.tier === 'opfs-worker')?.sessions).toBe(1)
  })

  test('aggregates perf timings into per-metric percentiles, dropping web_vitals', () => {
    // page_load: 5 samples 100..500 → p50 = 300, p95 = 500, max 500.
    for (const ms of [100, 200, 300, 400, 500])
      add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 's1', name: 'page_load', duration_ms: ms } })
    // viewer_boot: a single sample.
    add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 's1', name: 'viewer_boot', duration_ms: 1234 } })
    // web_vital carries `value`, not `duration_ms` — must be excluded from timings.
    add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 's1', name: 'web_vital', metric: 'LCP', value: 2.1 } })

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })

    const page_load = analytics.performance.summary.find(metric => metric.name === 'page_load')
    expect(page_load).toMatchObject({ count: 5, p50: 300, p95: 500, max: 500 })
    const viewer_boot = analytics.performance.summary.find(metric => metric.name === 'viewer_boot')
    expect(viewer_boot).toMatchObject({ count: 1, p50: 1234, p95: 1234, max: 1234 })
    // web_vital is not a timing metric.
    expect(analytics.performance.summary.some(metric => metric.name === 'web_vital')).toBeFalsy()
    // search is a known metric with no samples → present in summary with count 0, null percentiles.
    expect(analytics.performance.summary.find(metric => metric.name === 'search')).toMatchObject({ count: 0, p50: null })
    // Daily series carries the per-day p50/p95 for the latest day.
    const latest = analytics.performance.daily[analytics.performance.daily.length - 1]
    expect(latest?.day).toBe('2026-06-30')
    expect(latest?.metrics.page_load).toEqual({ p50: 300, p95: 500, count: 5 })
  })

  test('builds geo areas (hot + cold rollup) and geo-splits TTFB by country + distance', () => {
    const la: RequestGeo = { country: 'US', region: 'CA', city: 'Los Angeles', latitude: 34.05, longitude: -118.24 }
    const ny: RequestGeo = { country: 'US', region: 'NY', city: 'New York', latitude: 40.71, longitude: -74.01 }
    // Hot sessions: two in US-CA, one in US-NY. page_load TTFB rows carry coordinates.
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 'a' }, geo: la })
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 'b' }, geo: la })
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 'c' }, geo: ny })
    // page_load perf rows: NY (near, low ttfb) vs LA (far, high ttfb).
    add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 'c', name: 'page_load', duration_ms: 800, ttfb: 60 }, geo: ny })
    add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 'a', name: 'page_load', duration_ms: 1400, ttfb: 220 }, geo: la })
    // A cold (archived) day with only a geo rollup row.
    db.prepare(`INSERT INTO log_daily_metrics (day, metric, source, value) VALUES ('2026-06-05', 'geo:US-CA', 'client', 5)`).run()

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })

    // Areas merge hot (2 US-CA + 1 US-NY) with the cold rollup (+5 US-CA).
    expect(analytics.geo.areas.find(area => area.key === 'US-CA')).toEqual({ key: 'US-CA', country: 'US', sessions: 7 })
    expect(analytics.geo.areas.find(area => area.key === 'US-NY')?.sessions).toBe(1)
    expect(analytics.geo.located_sessions).toBe(8)

    // TTFB split by country (single US bucket here, 2 samples).
    expect(analytics.geo.ttfb_by_country.find(row => row.label === 'US')?.count).toBe(2)
    // TTFB split by distance: NY (~305 km) lands in the nearest bucket, LA (~4170 km) far.
    const near = analytics.geo.ttfb_by_distance.find(row => row.label === '< 500 km')
    const far = analytics.geo.ttfb_by_distance.find(row => row.label === '2,000–5,000 km')
    expect(near?.p50).toBe(60)
    expect(far?.p50).toBe(220)
  })

  test('falls back to the rollup for archived (cold) days with no live rows', () => {
    // An old day that has only a rollup row (raw logs already archived away).
    db.prepare(`INSERT INTO log_daily_metrics (day, metric, source, value) VALUES ('2026-06-05', 'logs', 'client', 42), ('2026-06-05', 'sessions', 'client', 7), ('2026-06-05', 'errors', 'client', 3)`).run()

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })
    const cold = analytics.daily.find(point => point.day === '2026-06-05')
    expect(cold).toEqual({ day: '2026-06-05', sessions: 7, users: 0, errors: 3, logs: 42 })
    expect(analytics.totals.logs).toBe(42)
  })
})
