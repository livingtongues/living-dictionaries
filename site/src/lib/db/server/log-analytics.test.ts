import type Database from 'better-sqlite3'
import type { RequestGeo } from '$lib/server/geo-from-request'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { insert_client_log } from '$lib/server/insert-client-log'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { get_log_analytics } from './log-analytics'
import { _reset_log_archive_db_for_tests } from './log-archive-db'
import { open_shared_db } from './shared-db'

let db: Database.Database
const NOW = new Date('2026-06-30T12:00:00.000Z')

beforeEach(() => {
  db = open_shared_db(':memory:')
})

afterEach(() => {
  db.close()
})

function add_log({ day, level = 'info', message = 'heartbeat', source = 'client', user_id = null, context = null, user_agent = null, app_version = null, stack = null, geo }: {
  day: string
  level?: 'error' | 'warn' | 'info' | 'unhandled_rejection' | 'crash'
  message?: string
  source?: 'client' | 'server'
  user_id?: string | null
  context?: Record<string, unknown> | null
  user_agent?: string | null
  app_version?: string | null
  stack?: string | null
  geo?: RequestGeo
}): void {
  insert_client_log({ payload: { level, message, context, user_agent, app_version, stack }, user_id, source, ...(geo ? { geo } : {}), db, now: new Date(`${day}T10:00:00.000Z`) })
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
    expect(last_day?.real_errors).toBe(1) // 'boom' is a genuine fault, not known-noise
    expect(last_day?.sessions).toBe(1)
    expect(prev_day?.day).toBe('2026-06-29')
    expect(prev_day?.users).toBe(1)
    // A day with no logs is present and zeroed.
    expect(analytics.daily[0]).toEqual({ day: '2026-06-01', sessions: 0, users: 0, errors: 0, real_errors: 0, stale_errors: 0, logs: 0 })

    expect(analytics.totals.logs).toBe(4)
    expect(analytics.totals.errors).toBe(1)
    expect(analytics.totals.real_errors).toBe(1)
    expect(analytics.totals.unique_users).toBe(2)
  })

  test('daily real_errors folds out known-noise + expected-response rows, raw errors keeps them', () => {
    add_log({ day: '2026-06-30', level: 'error', message: 'boom', context: { session_id: 's1' } })
    add_log({ day: '2026-06-30', level: 'error', message: 'Failed to fetch dynamically imported module: /_app/x.js', context: { session_id: 's1' } })
    add_log({ day: '2026-06-30', level: 'crash', message: 'Not found: /river/feedback', context: { session_id: 's1' } })

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })
    const last_day = analytics.daily[analytics.daily.length - 1]
    expect(last_day?.errors).toBe(3) // raw count keeps the stale-chunk + 404 rows
    expect(last_day?.real_errors).toBe(1) // only 'boom' is a genuine fault
    expect(analytics.totals.errors).toBe(3)
    expect(analytics.totals.real_errors).toBe(1)
  })

  test('daily stale_errors counts errors from non-current builds (deploy-day fold); unknown current version → 0', () => {
    add_log({ day: '2026-06-30', level: 'error', message: 'boom on old bundle', app_version: 'v-old', context: { session_id: 's1' } })
    add_log({ day: '2026-06-30', level: 'error', message: 'boom on current', app_version: 'v-cur', context: { session_id: 's1' } })
    add_log({ day: '2026-06-30', level: 'error', message: 'boom no version', context: { session_id: 's1' } })

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW, current_app_version: 'v-cur' })
    const last_day = analytics.daily[analytics.daily.length - 1]
    expect(last_day?.errors).toBe(3)
    expect(last_day?.stale_errors).toBe(1) // only the v-old row; version-less rows aren't assumed stale
    expect(analytics.totals.stale_errors).toBe(1)

    // Without a known current version the fold is off (everything would read stale otherwise).
    const unknown = get_log_analytics({ shared_db: db, days: 30, now: NOW, current_app_version: null })
    expect(unknown.totals.stale_errors).toBe(0)
  })

  test('top_routes ranks by distinct sessions so one loop-heavy session cannot outrank real routes', () => {
    // One session hammers /milang/entries 50×; three sessions each visit /about once.
    for (let i = 0; i < 50; i++)
      add_log({ day: '2026-06-30', message: 'navigation', context: { session_id: 's-loop', to: '/milang/entries' } })
    for (const sid of ['s1', 's2', 's3'])
      add_log({ day: '2026-06-30', message: 'navigation', context: { session_id: sid, to: '/about' } })

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })
    expect(analytics.top_routes[0]).toEqual({ route: 'about', count: 3, sessions: 3 })
    expect(analytics.top_routes[1]).toEqual({ route: 'dictionary:entry', count: 50, sessions: 1 })
  })

  test('api_v1 panel aggregates server v1_* events by day / event / dictionary / via with a failure split', () => {
    add_log({ day: '2026-06-30', source: 'server', message: 'v1_entry_updated', context: { dictionary_id: 'river', via: 'api_key' } })
    add_log({ day: '2026-06-30', source: 'server', message: 'v1_entry_updated', context: { dictionary_id: 'river', via: 'api_key' } })
    add_log({ day: '2026-06-30', source: 'server', message: 'v1_media_attached', context: { dictionary_id: 'river', via: 'api_key' } })
    add_log({ day: '2026-06-29', source: 'server', message: 'v1_sentence_updated', context: { dictionary_id: 'galo', via: 'session' } })
    add_log({ day: '2026-06-30', source: 'server', level: 'error', message: 'v1_feedback_failed', context: { dictionary_id: 'river', via: 'api_key' } })
    // Non-v1 rows and client rows must not leak in.
    add_log({ day: '2026-06-30', source: 'server', message: 'auth_login' })
    add_log({ day: '2026-06-30', source: 'client', message: 'v1_entry_updated', context: { session_id: 's1' } })

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })
    expect(analytics.api_v1.total).toBe(5)
    expect(analytics.api_v1.failures).toBe(1)
    expect(analytics.api_v1.daily).toEqual([
      { day: '2026-06-29', count: 1, failures: 0 },
      { day: '2026-06-30', count: 4, failures: 1 },
    ])
    expect(analytics.api_v1.by_event[0]).toEqual({ event: 'v1_entry_updated', count: 2 })
    expect(analytics.api_v1.by_dictionary).toEqual([
      { dictionary_id: 'river', count: 4 },
      { dictionary_id: 'galo', count: 1 },
    ])
    expect(analytics.api_v1.by_via).toEqual([
      { via: 'api_key', count: 4 },
      { via: 'session', count: 1 },
    ])
  })

  test('server_faults clusters server error rows by route+message and flags schema drift', () => {
    // Two occurrences of the same labelled fault, one carrying a status.
    add_log({ day: '2026-06-30', source: 'server', level: 'error', message: 'dictionary_create_failed', context: { route: '/api/dictionaries/create', status: 500 } })
    add_log({ day: '2026-06-30', source: 'server', level: 'error', message: 'dictionary_create_failed', context: { route: '/api/dictionaries/create', status: 500 } })
    // Schema-drift: the SqliteError text lives in the STACK, not the label.
    add_log({ day: '2026-06-30', source: 'server', level: 'error', message: 'admin_sync_failed', stack: 'SqliteError: no such column: dictionary_partners.role\n  at ...' })
    // Drift signalled by the message alone still counts.
    add_log({ day: '2026-06-29', source: 'server', level: 'crash', message: 'no such table: orthographies' })
    // Warn-level server rows and client errors must NOT appear.
    add_log({ day: '2026-06-30', source: 'server', level: 'warn', message: 'sync_missing_syncable_table' })
    add_log({ day: '2026-06-30', source: 'client', level: 'error', message: 'no such column: x', context: { session_id: 's1' } })

    const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW })
    expect(analytics.server_faults.total).toBe(4)
    expect(analytics.server_faults.schema_drift_count).toBe(2)
    expect(analytics.server_faults.clusters).toHaveLength(3)

    const create = analytics.server_faults.clusters.find(cluster => cluster.message === 'dictionary_create_failed')
    expect(create?.route).toBe('/api/dictionaries/create')
    expect(create?.count).toBe(2)
    expect(create?.statuses).toBe('500')
    expect(create?.is_schema_drift).toBeFalsy()

    expect(analytics.server_faults.clusters.find(cluster => cluster.message === 'admin_sync_failed')?.is_schema_drift).toBeTruthy()
    expect(analytics.server_faults.clusters.find(cluster => cluster.message === 'no such table: orthographies')?.is_schema_drift).toBeTruthy()
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

  test('excludes navigator.webdriver (headed Playwright) sessions from humans even with a plain Chrome UA', () => {
    // Headed Playwright reports a real Chrome UA — the bot regex can't catch it;
    // the `context.webdriver` flag is the signal (M1).
    const HEADED_PLAYWRIGHT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
    const REAL_HUMAN = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    add_log({ day: '2026-06-30', message: 'session_start', user_id: 'human', context: { session_id: 'real' }, user_agent: REAL_HUMAN })
    add_log({ day: '2026-06-30', message: 'search_performed', user_id: 'human', context: { session_id: 'real' }, user_agent: REAL_HUMAN })
    // Automated session: every row carries webdriver:true (remote-log stamps it on all rows).
    add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 'auto', webdriver: true }, user_agent: HEADED_PLAYWRIGHT })
    add_log({ day: '2026-06-30', message: 'search_performed', context: { session_id: 'auto', webdriver: true }, user_agent: HEADED_PLAYWRIGHT })

    const humans = get_log_analytics({ shared_db: db, days: 30, now: NOW, audience: 'humans' })
    expect(humans.totals.sessions).toBe(1) // only the real human
    expect(humans.top_events.find(event => event.event === 'search_performed')?.count).toBe(1)
    // The automated session is bucketed as a bot, kept out of the human total.
    expect(humans.capability.bot_sessions).toBe(1)
    expect(humans.capability.total_sessions).toBe(1)

    const bots = get_log_analytics({ shared_db: db, days: 30, now: NOW, audience: 'bots' })
    expect(bots.totals.sessions).toBe(1) // the webdriver session shows under bots
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

  test('missing i18n keys: ranks by distinct sessions, dedupes keys, excludes bots', () => {
    const BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    // `sd.animal` hit in two sessions (3 rows) → outranks `ps.verbo` (1 session, 1 row).
    add_log({ day: '2026-06-30', level: 'warn', message: 'i18n missing key: sd.animal', context: { session_id: 's1', i18n_key: 'sd.animal', locale: 'es' } })
    add_log({ day: '2026-06-30', level: 'warn', message: 'i18n missing key: sd.animal', context: { session_id: 's1', i18n_key: 'sd.animal', locale: 'es' } })
    add_log({ day: '2026-06-29', level: 'warn', message: 'i18n missing key: sd.animal', context: { session_id: 's2', i18n_key: 'sd.animal', locale: 'pt' } })
    add_log({ day: '2026-06-30', level: 'warn', message: 'i18n missing key: ps.verbo', context: { session_id: 's1', i18n_key: 'ps.verbo', locale: 'es' } })
    // A bot session must be excluded from the human worklist.
    add_log({ day: '2026-06-30', level: 'warn', message: 'i18n missing key: sd.fish', context: { session_id: 'b1', i18n_key: 'sd.fish', locale: 'es' }, user_agent: BOT })

    const { missing_i18n_keys } = get_log_analytics({ shared_db: db, days: 30, now: NOW })
    expect(missing_i18n_keys.distinct_keys).toBe(2) // bot's sd.fish excluded
    expect(missing_i18n_keys.total).toBe(4)
    expect(missing_i18n_keys.sessions).toBe(2)
    expect(missing_i18n_keys.keys[0]).toMatchObject({ key: 'sd.animal', sessions: 2, count: 3 })
    expect(missing_i18n_keys.keys[1]).toMatchObject({ key: 'ps.verbo', sessions: 1, count: 1 })
    expect(missing_i18n_keys.keys.find(row => row.key === 'sd.fish')).toBeUndefined()
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

  test('groups page-load timings per route, slowest p95 first (L2)', () => {
    const base = 'https://new.livingdictionaries.app'
    const now = new Date('2026-06-30T10:00:00Z')
    const perf = (duration_ms: number, url: string) =>
      insert_client_log({ payload: { level: 'info', message: 'perf', context: { session_id: 's1', name: 'page_load', duration_ms }, url }, user_id: null, db, now })
    // /about: fast (100, 200) → p95 200. Search params must NOT fragment the route.
    perf(100, `${base}/about`)
    perf(200, `${base}/about?x=1`)
    // /[dict]/entries/[id]: slow (1000, 2000) → p95 2000, normalized to dictionary:entry.
    perf(1000, `${base}/my-dict/entries/abc`)
    perf(2000, `${base}/my-dict/entries/def`)

    const { by_route } = get_log_analytics({ shared_db: db, days: 30, now: NOW }).performance
    // Slowest route (by p95) first.
    expect(by_route[0]).toMatchObject({ route: 'dictionary:entry', count: 2, p95: 2000 })
    const about = by_route.find(row => row.route === 'about')
    expect(about).toMatchObject({ count: 2, p95: 200 }) // /about + /about?x=1 collapse to one route
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
    // Archived days predate the split, so real_errors falls back to the raw error count.
    // stale_errors is hot-only (no app_version in the rollup) → 0 on cold days.
    expect(cold).toEqual({ day: '2026-06-05', sessions: 7, users: 0, errors: 3, real_errors: 3, stale_errors: 0, logs: 42 })
    expect(analytics.totals.logs).toBe(42)
  })

  // Whole-object drift guard for the section-builder refactor (kept parallel with
  // tutor): seed a fixture that touches EVERY section, then pin the FULL
  // LogAnalytics object so any change a field-specific test doesn't watch is
  // caught. `archived_rows` reads a real file via get_log_archive_db(), so point
  // DATA_DIR at a fresh temp dir (→ empty archive → deterministic 0).
  test('full-object output snapshot (refactor drift guard)', () => {
    const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    const OLD_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15'
    const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    const base = 'https://new.livingdictionaries.app'
    const la: RequestGeo = { country: 'US', region: 'CA', city: 'Los Angeles', latitude: 34.05, longitude: -118.24 }
    const ny: RequestGeo = { country: 'US', region: 'NY', city: 'New York', latitude: 40.71, longitude: -74.01 }
    // Direct insert for app_version-bearing rows (the leaner add_log doesn't forward it).
    const add_versioned = ({ day, message, level = 'info', app_version, context, user_agent }: { day: string, message: string, level?: 'error' | 'info', app_version: string, context?: Record<string, unknown>, user_agent?: string }) =>
      insert_client_log({ payload: { level, message, context: context ?? null, app_version, user_agent: user_agent ?? null }, user_id: null, source: 'client', db, now: new Date(`${day}T10:00:00.000Z`) })

    const prev_data_dir = process.env.DATA_DIR
    process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'log-analytics-snap-'))
    _reset_log_archive_db_for_tests()
    try {
      // Usage: human sessions w/ geo + db_tier, a bot, a webdriver automation session.
      add_log({ day: '2026-06-30', message: 'session_start', user_id: 'u1', context: { session_id: 's1', db_tier: 'opfs-worker', webdriver: false }, user_agent: MAC_SAFARI, geo: la })
      add_log({ day: '2026-06-30', message: 'session_start', user_id: 'u2', context: { session_id: 's2', webdriver: false }, user_agent: OLD_SAFARI, geo: ny })
      add_log({ day: '2026-06-29', message: 'session_start', user_id: 'u3', context: { session_id: 's3', webdriver: false }, user_agent: MAC_SAFARI, geo: la })
      add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 'b1', webdriver: false }, user_agent: GOOGLEBOT })
      add_log({ day: '2026-06-30', message: 'session_start', context: { session_id: 'wd1', webdriver: true }, user_agent: MAC_SAFARI })
      add_log({ day: '2026-06-30', message: 'search_performed', context: { session_id: 'wd1', webdriver: true }, user_agent: MAC_SAFARI })

      // Events + routes (info rows, infra excluded).
      add_log({ day: '2026-06-30', message: 'search_performed', user_id: 'u1', context: { session_id: 's1', webdriver: false } })
      add_log({ day: '2026-06-30', message: 'search_performed', user_id: 'u2', context: { session_id: 's2', webdriver: false } })
      add_log({ day: '2026-06-30', message: 'entry_opened', user_id: 'u1', context: { session_id: 's1', webdriver: false } })
      add_log({ day: '2026-06-30', message: 'navigation', context: { session_id: 's1', to: '/dictionaries', webdriver: false } })
      add_log({ day: '2026-06-30', message: 'navigation', context: { session_id: 's1', to: '/my-dict/entries/abc', webdriver: false } })

      // Errors: a real crash (clustered), a known-noise class, an expected-4xx; client + server.
      for (let i = 0; i < 3; i++)
        add_log({ day: '2026-06-30', level: 'crash', message: 'boom', user_id: 'u1', context: { session_id: 's1', webdriver: false } })
      for (let i = 0; i < 5; i++)
        add_log({ day: '2026-06-30', level: 'error', message: '[post_request] Network error for /api/log', context: { webdriver: false } })
      add_log({ day: '2026-06-30', level: 'error', message: 'Not found: /api/entries/abc', context: { webdriver: false } })
      add_log({ day: '2026-06-30', level: 'error', message: 'server-err', source: 'server' })

      // Build versions: deploys (human session_start w/ app_version) + errors_by_version.
      add_versioned({ day: '2026-06-29', message: 'session_start', app_version: '1717000000000', context: { session_id: 's3', webdriver: false }, user_agent: MAC_SAFARI })
      add_versioned({ day: '2026-06-30', message: 'session_start', app_version: 'v-cur', context: { session_id: 's1', webdriver: false }, user_agent: MAC_SAFARI })
      add_versioned({ day: '2026-06-30', level: 'error', message: 'versioned-boom', app_version: 'v-cur', context: { webdriver: false } })
      add_versioned({ day: '2026-06-30', level: 'error', message: 'stale-boom', app_version: 'v-old', context: { webdriver: false } })

      // Performance: page_load (per-route grouping via url), an extra metric, web_vital, ttfb.
      insert_client_log({ payload: { level: 'info', message: 'perf', context: { session_id: 's1', name: 'page_load', duration_ms: 500, ttfb: 60 }, url: `${base}/about` }, user_id: null, source: 'client', db, now: new Date('2026-06-30T10:00:00.000Z') })
      insert_client_log({ payload: { level: 'info', message: 'perf', context: { session_id: 's1', name: 'page_load', duration_ms: 1400, ttfb: 220 }, url: `${base}/my-dict/entries/abc` }, user_id: null, source: 'client', db, now: new Date('2026-06-30T10:00:00.000Z') })
      add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 's1', name: 'viewer_boot', duration_ms: 1234, webdriver: false } })
      for (const value of [1000, 1500, 2000, 2500, 3000])
        add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 's1', name: 'web_vital', metric: 'LCP', value, webdriver: false } })
      // Geo ttfb coords (page_load with country/coords): NY near, LA far from Boston origin.
      add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 's2', name: 'page_load', duration_ms: 800, ttfb: 70 }, geo: ny })
      add_log({ day: '2026-06-30', message: 'perf', context: { session_id: 's1', name: 'page_load', duration_ms: 1500, ttfb: 240 }, geo: la })

      // Leader-worker DB health: timeouts paired with recoveries + real failures.
      // Two failures: one on a STALE build (no leader, NOTADB) + one on the CURRENT
      // build (timeout) — exercises failed_by_code + the current/stale split.
      add_log({ day: '2026-06-30', message: 'live_query_timeout', context: { session_id: 's1' } })
      add_log({ day: '2026-06-30', message: 'live_query_recovered', context: { session_id: 's1' } })
      add_versioned({ day: '2026-06-30', level: 'error', message: 'live_query_failed', app_version: 'v-old', context: { session_id: 's1', had_leader: 0, source: 'viewer', code: 'NOTADB' } })
      add_versioned({ day: '2026-06-30', level: 'error', message: 'live_query_failed', app_version: 'v-cur', context: { session_id: 's2', had_leader: 1, source: 'dict', code: 'timeout' } })

      // A cold (archived) day with only rollup rows, incl a geo bucket + an event.
      db.prepare(`INSERT INTO log_daily_metrics (day, metric, source, value) VALUES ('2026-06-05', 'logs', 'client', 42), ('2026-06-05', 'sessions', 'client', 7), ('2026-06-05', 'errors', 'client', 3), ('2026-06-05', 'geo:US-CA', 'client', 5), ('2026-06-05', 'event:search_performed', 'client', 9), ('2026-06-05', 'nav:about', 'client', 4)`).run()

      const analytics = get_log_analytics({ shared_db: db, days: 30, now: NOW, current_app_version: 'v-cur' })
      expect(analytics).toMatchInlineSnapshot(`
        {
          "api_v1": {
            "by_dictionary": [],
            "by_event": [],
            "by_via": [],
            "daily": [],
            "failures": 0,
            "total": 0,
          },
          "audience": "humans",
          "by_source": [
            {
              "errors": 16,
              "logs": 77,
              "source": "client",
            },
            {
              "errors": 1,
              "logs": 1,
              "source": "server",
            },
          ],
          "capability": {
            "below_capability_sessions": 1,
            "bot_sessions": 2,
            "browsers": [
              {
                "browser": "Safari",
                "sessions": 3,
              },
            ],
            "db_tiers": [
              {
                "sessions": 1,
                "tier": "opfs-worker",
              },
            ],
            "devices": [
              {
                "device": "desktop",
                "sessions": 3,
              },
            ],
            "os": [
              {
                "os": "macOS",
                "sessions": 3,
                "versions": [
                  {
                    "sessions": 3,
                    "version": "10.15",
                  },
                ],
              },
            ],
            "total_sessions": 3,
          },
          "daily": [
            {
              "day": "2026-06-01",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-02",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-03",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-04",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-05",
              "errors": 3,
              "logs": 42,
              "real_errors": 3,
              "sessions": 7,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-06",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-07",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-08",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-09",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-10",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-11",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-12",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-13",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-14",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-15",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-16",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-17",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-18",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-19",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-20",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-21",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-22",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-23",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-24",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-25",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-26",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-27",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-28",
              "errors": 0,
              "logs": 0,
              "real_errors": 0,
              "sessions": 0,
              "stale_errors": 0,
              "users": 0,
            },
            {
              "day": "2026-06-29",
              "errors": 0,
              "logs": 2,
              "real_errors": 0,
              "sessions": 1,
              "stale_errors": 0,
              "users": 1,
            },
            {
              "day": "2026-06-30",
              "errors": 14,
              "logs": 34,
              "real_errors": 8,
              "sessions": 2,
              "stale_errors": 2,
              "users": 2,
            },
          ],
          "deploys": [
            {
              "day": "2026-06-29",
              "first_seen": "2026-06-29T10:00:00.000Z",
              "sessions": 1,
              "version": "1717000000000",
            },
            {
              "day": "2026-06-30",
              "first_seen": "2026-06-30T10:00:00.000Z",
              "sessions": 2,
              "version": "v-cur",
            },
            {
              "day": "2026-06-30",
              "first_seen": "2026-06-30T10:00:00.000Z",
              "sessions": 1,
              "version": "v-old",
            },
          ],
          "error_clusters": [
            {
              "count": 3,
              "first_seen": "2026-06-30T10:00:00.000Z",
              "is_noise": false,
              "last_seen": "2026-06-30T10:00:00.000Z",
              "level": "crash",
              "message": "boom",
              "platforms": "web",
              "sources": "client",
              "stack_head": "",
              "users": 1,
            },
            {
              "count": 2,
              "first_seen": "2026-06-30T10:00:00.000Z",
              "is_noise": false,
              "last_seen": "2026-06-30T10:00:00.000Z",
              "level": "error",
              "message": "live_query_failed",
              "platforms": "web",
              "sources": "client",
              "stack_head": "",
              "users": 0,
            },
            {
              "count": 1,
              "first_seen": "2026-06-30T10:00:00.000Z",
              "is_noise": false,
              "last_seen": "2026-06-30T10:00:00.000Z",
              "level": "error",
              "message": "versioned-boom",
              "platforms": "web",
              "sources": "client",
              "stack_head": "",
              "users": 0,
            },
            {
              "count": 1,
              "first_seen": "2026-06-30T10:00:00.000Z",
              "is_noise": false,
              "last_seen": "2026-06-30T10:00:00.000Z",
              "level": "error",
              "message": "stale-boom",
              "platforms": "web",
              "sources": "client",
              "stack_head": "",
              "users": 0,
            },
            {
              "count": 1,
              "first_seen": "2026-06-30T10:00:00.000Z",
              "is_noise": false,
              "last_seen": "2026-06-30T10:00:00.000Z",
              "level": "error",
              "message": "server-err",
              "platforms": "web",
              "sources": "server",
              "stack_head": "",
              "users": 0,
            },
            {
              "count": 5,
              "first_seen": "2026-06-30T10:00:00.000Z",
              "is_noise": true,
              "last_seen": "2026-06-30T10:00:00.000Z",
              "level": "error",
              "message": "[post_request] Network error for /api/log",
              "platforms": "web",
              "sources": "client",
              "stack_head": "",
              "users": 0,
            },
            {
              "count": 1,
              "first_seen": "2026-06-30T10:00:00.000Z",
              "is_noise": true,
              "last_seen": "2026-06-30T10:00:00.000Z",
              "level": "error",
              "message": "Not found: /api/entries/abc",
              "platforms": "web",
              "sources": "client",
              "stack_head": "",
              "users": 0,
            },
          ],
          "errors_by_version": {
            "current": 2,
            "current_version": "v-cur",
            "stale": 12,
            "stale_pct": 0.8571428571428571,
            "total": 14,
            "versions": [
              {
                "errors": 10,
                "is_current": false,
                "version": null,
              },
              {
                "errors": 2,
                "is_current": true,
                "version": "v-cur",
              },
              {
                "errors": 2,
                "is_current": false,
                "version": "v-old",
              },
            ],
          },
          "event_coverage": {
            "events": [
              {
                "count": 11,
                "event": "search_performed",
                "seen": true,
              },
              {
                "count": 0,
                "event": "dictionary_opened",
                "seen": false,
              },
              {
                "count": 1,
                "event": "entry_opened",
                "seen": true,
              },
              {
                "count": 0,
                "event": "audio_played",
                "seen": false,
              },
              {
                "count": 0,
                "event": "entry_created",
                "seen": false,
              },
              {
                "count": 0,
                "event": "entry_deleted",
                "seen": false,
              },
            ],
            "never_emitted": 4,
          },
          "generated_at": "2026-06-30T12:00:00.000Z",
          "geo": {
            "areas": [
              {
                "country": "US",
                "key": "US-CA",
                "sessions": 7,
              },
              {
                "country": "US",
                "key": "US-NY",
                "sessions": 1,
              },
            ],
            "located_sessions": 8,
            "ttfb_by_country": [
              {
                "count": 2,
                "label": "US",
                "p50": 70,
                "p95": 240,
              },
            ],
            "ttfb_by_distance": [
              {
                "count": 1,
                "label": "< 500 km",
                "p50": 70,
                "p95": 70,
              },
              {
                "count": 1,
                "label": "2,000–5,000 km",
                "p50": 240,
                "p95": 240,
              },
            ],
          },
          "leader_health": {
            "failed": 2,
            "failed_by_code": [
              {
                "code": "timeout",
                "count": 1,
              },
              {
                "code": "NOTADB",
                "count": 1,
              },
            ],
            "failed_by_source": [
              {
                "count": 2,
                "source": "viewer",
              },
            ],
            "failed_current": 1,
            "failed_no_leader": 1,
            "failed_stale": 1,
            "recovered": 1,
            "timeouts": 1,
          },
          "missing_i18n_keys": {
            "distinct_keys": 0,
            "keys": [],
            "sessions": 0,
            "total": 0,
          },
          "performance": {
            "by_route": [
              {
                "count": 1,
                "max": 1400,
                "p50": 1400,
                "p95": 1400,
                "route": "dictionary:entry",
              },
              {
                "count": 1,
                "max": 500,
                "p50": 500,
                "p95": 500,
                "route": "about",
              },
            ],
            "daily": [
              {
                "day": "2026-06-01",
                "metrics": {},
              },
              {
                "day": "2026-06-02",
                "metrics": {},
              },
              {
                "day": "2026-06-03",
                "metrics": {},
              },
              {
                "day": "2026-06-04",
                "metrics": {},
              },
              {
                "day": "2026-06-05",
                "metrics": {},
              },
              {
                "day": "2026-06-06",
                "metrics": {},
              },
              {
                "day": "2026-06-07",
                "metrics": {},
              },
              {
                "day": "2026-06-08",
                "metrics": {},
              },
              {
                "day": "2026-06-09",
                "metrics": {},
              },
              {
                "day": "2026-06-10",
                "metrics": {},
              },
              {
                "day": "2026-06-11",
                "metrics": {},
              },
              {
                "day": "2026-06-12",
                "metrics": {},
              },
              {
                "day": "2026-06-13",
                "metrics": {},
              },
              {
                "day": "2026-06-14",
                "metrics": {},
              },
              {
                "day": "2026-06-15",
                "metrics": {},
              },
              {
                "day": "2026-06-16",
                "metrics": {},
              },
              {
                "day": "2026-06-17",
                "metrics": {},
              },
              {
                "day": "2026-06-18",
                "metrics": {},
              },
              {
                "day": "2026-06-19",
                "metrics": {},
              },
              {
                "day": "2026-06-20",
                "metrics": {},
              },
              {
                "day": "2026-06-21",
                "metrics": {},
              },
              {
                "day": "2026-06-22",
                "metrics": {},
              },
              {
                "day": "2026-06-23",
                "metrics": {},
              },
              {
                "day": "2026-06-24",
                "metrics": {},
              },
              {
                "day": "2026-06-25",
                "metrics": {},
              },
              {
                "day": "2026-06-26",
                "metrics": {},
              },
              {
                "day": "2026-06-27",
                "metrics": {},
              },
              {
                "day": "2026-06-28",
                "metrics": {},
              },
              {
                "day": "2026-06-29",
                "metrics": {},
              },
              {
                "day": "2026-06-30",
                "metrics": {
                  "page_load": {
                    "count": 4,
                    "p50": 800,
                    "p95": 1500,
                  },
                  "viewer_boot": {
                    "count": 1,
                    "p50": 1234,
                    "p95": 1234,
                  },
                },
              },
            ],
            "summary": [
              {
                "count": 4,
                "max": 1500,
                "name": "page_load",
                "p50": 800,
                "p90": 1500,
                "p95": 1500,
                "slowest": {
                  "duration_ms": 1500,
                  "route": "?",
                },
              },
              {
                "count": 0,
                "max": null,
                "name": "search",
                "p50": null,
                "p90": null,
                "p95": null,
                "slowest": null,
              },
              {
                "count": 1,
                "max": 1234,
                "name": "viewer_boot",
                "p50": 1234,
                "p90": 1234,
                "p95": 1234,
                "slowest": {
                  "duration_ms": 1234,
                  "route": "?",
                },
              },
            ],
          },
          "pipeline": {
            "archived_rows": 0,
            "hot_rows": 39,
            "last_log_at": "2026-06-30T10:00:00.000Z",
            "last_server_log_at": "2026-06-30T10:00:00.000Z",
            "last_session_start_at": "2026-06-30T10:00:00.000Z",
            "missing_syncable_tables": [],
            "retention_ran_at": null,
          },
          "server_faults": {
            "clusters": [
              {
                "count": 1,
                "first_seen": "2026-06-30T10:00:00.000Z",
                "is_schema_drift": false,
                "last_seen": "2026-06-30T10:00:00.000Z",
                "message": "server-err",
                "route": null,
                "statuses": null,
              },
            ],
            "schema_drift_count": 0,
            "total": 1,
          },
          "top_events": [
            {
              "count": 11,
              "event": "search_performed",
            },
            {
              "count": 1,
              "event": "entry_opened",
            },
            {
              "count": 1,
              "event": "live_query_recovered",
            },
            {
              "count": 1,
              "event": "live_query_timeout",
            },
          ],
          "top_routes": [
            {
              "count": 1,
              "route": "dictionaries",
              "sessions": 1,
            },
            {
              "count": 1,
              "route": "dictionary:entry",
              "sessions": 1,
            },
            {
              "count": 4,
              "route": "about",
              "sessions": 0,
            },
          ],
          "totals": {
            "errors": 17,
            "logs": 78,
            "real_errors": 11,
            "sessions": 10,
            "stale_errors": 2,
            "unique_users": 3,
          },
          "web_vitals": [
            {
              "count": 5,
              "metric": "LCP",
              "p50": 2000,
              "p75": 2500,
              "p95": 3000,
            },
          ],
          "window_days": 30,
        }
      `)
    } finally {
      _reset_log_archive_db_for_tests()
      if (prev_data_dir === undefined)
        delete process.env.DATA_DIR
      else
        process.env.DATA_DIR = prev_data_dir
    }
  })
})
