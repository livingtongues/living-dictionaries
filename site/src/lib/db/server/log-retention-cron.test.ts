import type Database from 'better-sqlite3'
import type { RequestGeo } from '$lib/server/geo-from-request'
import { insert_client_log } from '$lib/server/insert-client-log'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_log_archive_db } from './log-archive-db'
import { archive_old_logs, get_rollup_watermark, normalize_route, reroll_archived_days_once, rollup_day, run_log_retention_once } from './log-retention-cron'
import { open_logs_db } from './logs-db'
import { open_shared_db } from './shared-db'

let shared_db: Database.Database
let logs_db: Database.Database
let archive_db: Database.Database

beforeEach(() => {
  shared_db = open_shared_db(':memory:')
  logs_db = open_logs_db(':memory:')
  archive_db = open_log_archive_db(':memory:')
})

afterEach(() => {
  shared_db.close()
  logs_db.close()
  archive_db.close()
})

function add_log({ day = '2026-06-01', time = '12:00:00', level = 'info', message = 'heartbeat', source = 'client', user_id = null, context = null, user_agent = null, geo, db = logs_db }: {
  day?: string
  time?: string
  level?: 'error' | 'warn' | 'info' | 'unhandled_rejection' | 'crash'
  message?: string
  source?: 'client' | 'server'
  user_id?: string | null
  context?: Record<string, unknown> | null
  user_agent?: string | null
  geo?: RequestGeo
  db?: Database.Database
}): void {
  insert_client_log({
    payload: { level, message, context, user_agent },
    user_id,
    source,
    ...(geo ? { geo } : {}),
    db,
    now: new Date(`${day}T${time}.000Z`),
  })
}

function metric(day: string, name: string, source = 'client'): number | undefined {
  const row = shared_db.prepare('SELECT value FROM log_daily_metrics WHERE day = ? AND metric = ? AND source = ?').get(day, name, source) as { value: number } | undefined
  return row?.value
}

describe(normalize_route, () => {
  test('buckets top-level + per-dictionary routes and handles edge cases', () => {
    expect(normalize_route('/')).toBe('home')
    expect(normalize_route('/dictionaries')).toBe('dictionaries')
    expect(normalize_route('/account/settings')).toBe('account')
    expect(normalize_route('/admin/users')).toBe('admin')
    expect(normalize_route('/create-dictionary')).toBe('create-dictionary')
    expect(normalize_route('/my-dict-id')).toBe('dictionary:entries')
    expect(normalize_route('/my-dict-id/entries/abc123')).toBe('dictionary:entry')
    expect(normalize_route('/my-dict-id/settings')).toBe('dictionary:settings')
    expect(normalize_route(null)).toBe('unknown')
  })
})

describe(rollup_day, () => {
  test('aggregates sessions, users, errors, real_errors, levels, events, nav buckets, geo, and sessions per source', () => {
    add_log({ message: 'session_start', user_id: 'u1', context: { session_id: 's1' }, geo: { country: 'US', region: 'CA', city: null, latitude: null, longitude: null } })
    add_log({ message: 'heartbeat', user_id: 'u1', context: { session_id: 's1' }, geo: { country: 'US', region: 'CA', city: null, latitude: null, longitude: null } })
    add_log({ message: 'navigation', user_id: 'u1', context: { session_id: 's1', to: '/dictionaries' } })
    add_log({ message: 'navigation', user_id: 'u1', context: { session_id: 's1', to: '/my-dict/entries/x' } })
    add_log({ message: 'search_performed', user_id: 'u1', context: { session_id: 's1', query: 'esot' } })
    add_log({ level: 'error', message: 'boom', user_id: null, context: { session_id: 's2' }, geo: { country: 'GB', region: null, city: null, latitude: null, longitude: null } })
    // A known-noise error → counts in errors but NOT real_errors.
    add_log({ level: 'error', message: 'Failed to fetch dynamically imported module: /_app/x.js', context: { session_id: 's2' } })
    add_log({ level: 'error', message: 'srv', source: 'server', context: null })

    const { metrics_written } = rollup_day({ day: '2026-06-01', shared_db, logs_db })
    expect(metrics_written).toBeTruthy()

    expect(metric('2026-06-01', 'sessions')).toBe(2)
    expect(metric('2026-06-01', 'users')).toBe(1)
    expect(metric('2026-06-01', 'errors')).toBe(2)
    expect(metric('2026-06-01', 'real_errors')).toBe(1) // stale-chunk fetch folded out
    expect(metric('2026-06-01', 'logs')).toBe(7)
    expect(metric('2026-06-01', 'event:search_performed')).toBe(1)
    expect(metric('2026-06-01', 'nav:dictionaries')).toBe(1)
    expect(metric('2026-06-01', 'nav:dictionary:entry')).toBe(1)
    expect(metric('2026-06-01', 'geo:US-CA')).toBe(1)
    expect(metric('2026-06-01', 'geo:GB')).toBe(1)

    expect(metric('2026-06-01', 'errors', 'server')).toBe(1)
    expect(metric('2026-06-01', 'logs', 'server')).toBe(1)

    // Per-session materialization is written alongside the metrics.
    const sessions = shared_db.prepare(`SELECT session_id, heartbeats, has_user_id FROM log_daily_sessions WHERE day = ? ORDER BY session_id`).all('2026-06-01') as { session_id: string, heartbeats: number, has_user_id: number }[]
    expect(sessions).toEqual([
      { session_id: 's1', heartbeats: 1, has_user_id: 1 },
      { session_id: 's2', heartbeats: 0, has_user_id: 0 },
    ])
  })

  test('is idempotent — re-running overwrites, never doubles', () => {
    add_log({ message: 'heartbeat', context: { session_id: 's1' } })
    rollup_day({ day: '2026-06-01', shared_db, logs_db })
    rollup_day({ day: '2026-06-01', shared_db, logs_db })
    expect(metric('2026-06-01', 'logs')).toBe(1)
    expect((shared_db.prepare(`SELECT COUNT(*) n FROM log_daily_sessions WHERE day = '2026-06-01'`).get() as { n: number }).n).toBe(1)
  })

  test('full-day REPLACE purges a metric that no longer occurs (ghost-metric fix)', () => {
    add_log({ message: 'navigation', context: { session_id: 's1', to: '/dictionaries' } })
    rollup_day({ day: '2026-06-01', shared_db, logs_db })
    expect(metric('2026-06-01', 'nav:dictionaries')).toBe(1)
    // The raw row disappears (e.g. re-classified), and a re-roll must drop the stale metric.
    logs_db.prepare('DELETE FROM client_logs').run()
    add_log({ message: 'navigation', context: { session_id: 's1', to: '/about' } })
    rollup_day({ day: '2026-06-01', shared_db, logs_db })
    expect(metric('2026-06-01', 'nav:dictionaries')).toBeUndefined() // ghost purged
    expect(metric('2026-06-01', 'nav:about')).toBe(1)
  })

  test('splits bot/headless rows into a parallel bot: namespace (human metrics unaffected; server rows kept)', () => {
    const HEADLESS = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36'
    add_log({ message: 'session_start', user_id: 'human', context: { session_id: 'h1' }, user_agent: 'Mozilla/5.0 Chrome/148' })
    add_log({ message: 'search_performed', user_id: 'human', context: { session_id: 'h1' }, user_agent: 'Mozilla/5.0 Chrome/148' })
    add_log({ message: 'session_start', context: { session_id: 'b1' }, user_agent: HEADLESS })
    add_log({ message: 'search_performed', context: { session_id: 'b1' }, user_agent: HEADLESS })
    add_log({ message: 'auth_login', source: 'server' })

    rollup_day({ day: '2026-06-01', shared_db, logs_db })
    expect(metric('2026-06-01', 'sessions')).toBe(1)
    expect(metric('2026-06-01', 'users')).toBe(1)
    expect(metric('2026-06-01', 'event:search_performed')).toBe(1)
    expect(metric('2026-06-01', 'logs')).toBe(2)
    expect(metric('2026-06-01', 'logs', 'server')).toBe(1)
    expect(metric('2026-06-01', 'bot:sessions')).toBe(1)
    expect(metric('2026-06-01', 'bot:event:search_performed')).toBe(1)
    expect(metric('2026-06-01', 'bot:logs')).toBe(2)
  })

  test('classifies a spoofed-UA UA-frequency crawler cluster as bots even without a bot UA regex match', () => {
    const SPOOF = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    // 25 anonymous, zero-heartbeat sessions on one plausible-human UA in a day = crawler.
    for (let i = 0; i < 25; i++)
      add_log({ message: 'session_start', context: { session_id: `c${i}` }, user_agent: SPOOF })
    // One real human on the SAME UA who dwelled (a heartbeat) → stays human.
    add_log({ message: 'session_start', user_id: 'real', context: { session_id: 'real' }, user_agent: SPOOF })
    add_log({ message: 'heartbeat', user_id: 'real', context: { session_id: 'real' }, user_agent: SPOOF })

    rollup_day({ day: '2026-06-01', shared_db, logs_db })
    expect(metric('2026-06-01', 'sessions')).toBe(1) // only the dwelling human
    expect(metric('2026-06-01', 'bot:sessions')).toBe(25)
  })
})

describe(archive_old_logs, () => {
  test('moves rows older than the hot window from logs.db and prunes the archive past its window', () => {
    const now = new Date('2026-06-30T00:00:00.000Z')
    add_log({ day: '2026-06-29', message: 'recent' })
    add_log({ day: '2026-06-10', message: 'aged' })
    add_log({ day: '2026-03-01', message: 'ancient' })

    const { archived } = archive_old_logs({ logs_db, archive_db, now })
    expect(archived).toBe(2)

    const hot = logs_db.prepare('SELECT message FROM client_logs').all() as { message: string }[]
    expect(hot.map(r => r.message)).toEqual(['recent'])

    const archived_rows = archive_db.prepare('SELECT message FROM client_logs ORDER BY message').all() as { message: string }[]
    expect(archived_rows.map(r => r.message)).toEqual(['aged'])
  })
})

describe(run_log_retention_once, () => {
  test('rolls up days past the watermark, advances the watermark, archives, and records a run marker', () => {
    const now = new Date('2026-06-30T00:00:00.000Z')
    add_log({ day: '2026-06-29', message: 'heartbeat', context: { session_id: 's1' } })
    add_log({ day: '2026-06-10', message: 'heartbeat', context: { session_id: 's2' } })

    const result = run_log_retention_once({ shared_db, logs_db, archive_db, now })
    expect(result.days_rolled).toBe(2)
    expect(result.archived).toBe(1)

    expect(metric('2026-06-29', 'sessions')).toBe(1)
    expect(metric('2026-06-10', 'sessions')).toBe(1)
    // Watermark advanced to yesterday (2026-06-29).
    expect(get_rollup_watermark(shared_db)).toBe('2026-06-29')

    const marker = shared_db.prepare(`SELECT value FROM db_metadata WHERE key = 'log_retention_ran_at'`).get() as { value: string }
    expect(marker.value).toBe(now.toISOString())
  })

  test('a second sweep only re-rolls days past the watermark (no full re-parse)', () => {
    const now = new Date('2026-06-30T00:00:00.000Z')
    add_log({ day: '2026-06-29', message: 'heartbeat', context: { session_id: 's1' } })
    run_log_retention_once({ shared_db, logs_db, archive_db, now })
    // Second sweep same day: 2026-06-29 is now ≤ watermark, only "today"+ re-rolls.
    const second = run_log_retention_once({ shared_db, logs_db, archive_db, now })
    expect(second.days_rolled).toBe(0)
  })
})

describe(reroll_archived_days_once, () => {
  test('heals archived days under current rules once, then never again', () => {
    // An archived day (raw rows only in the archive file), older than anything hot.
    insert_client_log({ payload: { level: 'error', message: 'boom', context: { session_id: 's1' } }, user_id: null, db: archive_db, now: new Date('2026-05-01T10:00:00.000Z') })
    add_log({ day: '2026-06-29', message: 'heartbeat', context: { session_id: 's2' } }) // keeps hot_min_day after the archived day

    const first = reroll_archived_days_once({ shared_db, logs_db, archive_db })
    expect(first.days_rerolled).toBe(1)
    expect(metric('2026-05-01', 'errors')).toBe(1)
    expect(metric('2026-05-01', 'real_errors')).toBe(1)

    const second = reroll_archived_days_once({ shared_db, logs_db, archive_db })
    expect(second.days_rerolled).toBe(0) // flagged, never re-runs
  })
})
