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

  test('splits client vs server source and clusters errors', () => {
    add_log({ day: '2026-06-30', level: 'error', message: 'client-err' })
    add_log({ day: '2026-06-30', level: 'error', message: 'server-err', source: 'server' })

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })

    expect(analytics.by_source.find(s => s.source === 'client')?.errors).toBe(1)
    expect(analytics.by_source.find(s => s.source === 'server')?.errors).toBe(1)
    expect(analytics.error_clusters.map(e => e.message).sort()).toEqual(['client-err', 'server-err'])
  })

  test('audience toggle filters usage to humans (default) or bots', () => {
    const BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    const HUMAN = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    add_log({ day: '2026-06-30', message: 'session_start', user_agent: HUMAN, context: { session_id: 'hs' } })
    add_log({ day: '2026-06-30', message: 'session_start', user_agent: BOT, context: { session_id: 'bs1' } })
    add_log({ day: '2026-06-30', message: 'session_start', user_agent: BOT, context: { session_id: 'bs2' } })

    const humans = get_log_analytics({ shared_db: db, days: 30, now: NOW, audience: 'humans' })
    expect(humans.audience).toBe('humans')
    expect(humans.totals.sessions).toBe(1)

    const bots = get_log_analytics({ shared_db: db, days: 30, now: NOW, audience: 'bots' })
    expect(bots.audience).toBe('bots')
    expect(bots.totals.sessions).toBe(2)
  })

  test('clusters repeated errors, tags + sinks known-noise', () => {
    for (let i = 0; i < 5; i++)
      add_log({ day: '2026-06-30', level: 'error', message: 'boom', user_id: `u${i}` })
    for (let i = 0; i < 30; i++)
      add_log({ day: '2026-06-30', level: 'error', message: '[post_request] Network error for /api/log' })

    const clusters = get_log_analytics({ shared_db: db, days: 30, now: NOW }).error_clusters
    expect(clusters.find(c => c.message === 'boom')).toMatchObject({ count: 5, users: 5, is_noise: false })
    expect(clusters[0].message).toBe('boom')
    expect(clusters[clusters.length - 1]).toMatchObject({ is_noise: true })
  })

  test('device / OS / browser breakdown excludes bots and flags below-capability sessions', () => {
    const SAFARI17 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    const SAFARI14 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15'
    const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
    const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36'
    const APPLEBOT = `${SAFARI17} (Applebot/0.1; +http://www.apple.com/go/applebot)`
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 's1', db_tier: 'opfs-worker' }, user_agent: SAFARI17 })
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 's2' }, user_agent: SAFARI14 })
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 's4' }, user_agent: IPHONE })
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 's5' }, user_agent: ANDROID })
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 's3' }, user_agent: APPLEBOT })

    const { capability } = get_log_analytics({ shared_db: db, days: 30, now: NOW })

    expect(capability.bot_sessions).toBe(1)
    expect(capability.total_sessions).toBe(4) // bots excluded from human total
    expect(capability.below_capability_sessions).toBe(1) // Safari 14 < 15.4
    // Device split: 2 desktop (macOS Safari) + 2 mobile (iPhone + Android phone).
    expect(capability.devices.find(row => row.device === 'desktop')?.sessions).toBe(2)
    expect(capability.devices.find(row => row.device === 'mobile')?.sessions).toBe(2)
    // OS nested versions: iOS 18 sub-bucket present; Applebot must NOT inflate macOS.
    expect(capability.os.find(row => row.os === 'macOS')?.sessions).toBe(2)
    expect(capability.os.find(row => row.os === 'iOS')?.versions).toEqual([{ version: '18', sessions: 1 }])
    // Browser families (Applebot excluded): Safari = 3 (2 macOS + 1 iPhone), Chrome = 1.
    expect(capability.browsers.find(row => row.browser === 'Safari')?.sessions).toBe(3)
    expect(capability.browsers.find(row => row.browser === 'Chrome')?.sessions).toBe(1)
    expect(capability.db_tiers.find(tier => tier.tier === 'opfs-worker')?.sessions).toBe(1)
  })

  test('excludes bot/headless sessions from usage, events, geo + perf (kept only in capability.bot_sessions)', () => {
    const HUMAN = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
    const HEADLESS = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36'
    const la: RequestGeo = { country: 'US', region: 'CA', city: 'Los Angeles', latitude: 34.05, longitude: -118.24 }
    // Human session: search + nav + page_load.
    add_log({ day: '2026-06-30', message: 'session_start', user_id: 'human', context: { session_id: 'h1' }, user_agent: HUMAN, geo: la })
    add_log({ day: '2026-06-30', message: 'search_performed', user_id: 'human', context: { session_id: 'h1' }, user_agent: HUMAN })
    add_log({ day: '2026-06-30', message: 'navigation', context: { session_id: 'h1', to: '/dictionaries' }, user_agent: HUMAN })
    add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 'h1', name: 'page_load', duration_ms: 500, ttfb: 100 }, user_agent: HUMAN, geo: la })
    add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 'h1', name: 'web_vital', metric: 'LCP', value: 1800 }, user_agent: HUMAN })
    // Headless bot session: identical activity, must NOT count toward usage.
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 'b1' }, user_agent: HEADLESS, geo: la })
    add_log({ day: '2026-06-30', message: 'search_performed', context: { session_id: 'b1' }, user_agent: HEADLESS })
    add_log({ day: '2026-06-30', message: 'navigation', context: { session_id: 'b1', to: '/dictionaries' }, user_agent: HEADLESS })
    add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 'b1', name: 'page_load', duration_ms: 9000, ttfb: 9000 }, user_agent: HEADLESS, geo: la })
    add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 'b1', name: 'web_vital', metric: 'LCP', value: 9999 }, user_agent: HEADLESS })
    // Server row carries no user_agent (NULL) → always kept.
    add_log({ day: '2026-06-30', source: 'server', message: 'auth_login' })

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })
    const today = analytics.daily[analytics.daily.length - 1]
    expect(today?.sessions).toBe(1) // only the human session
    expect(today?.users).toBe(1)
    expect(analytics.totals.unique_users).toBe(1)
    expect(analytics.top_events.find(event => event.event === 'search_performed')?.count).toBe(1)
    expect(analytics.top_routes.find(route => route.route === 'dictionaries')?.count).toBe(1)
    expect(analytics.geo.located_sessions).toBe(1)
    // perf + web vitals reflect only the human sample (bot's 9000 excluded).
    expect(analytics.performance.summary.find(metric => metric.name === 'page_load')).toMatchObject({ count: 1, p50: 500 })
    expect(analytics.web_vitals.find(vital => vital.metric === 'LCP')).toMatchObject({ count: 1, p50: 1800 })
    // The bot is still visible — counted separately, kept out of the human total.
    expect(analytics.capability.bot_sessions).toBe(1)
    expect(analytics.capability.total_sessions).toBe(1)
    // Server-sourced rows are NOT treated as bots.
    expect(analytics.by_source.find(source => source.source === 'server')?.logs).toBe(1)
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
