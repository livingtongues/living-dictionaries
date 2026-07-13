import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import type { RequestGeo } from '$lib/server/geo-from-request'
import { insert_client_log } from '$lib/server/insert-client-log'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_log_archive_db } from './log-archive-db'
import { archive_old_logs, get_rollup_watermark, MONTHLY_FINALIZED_KEY, normalize_route, prev_month, reroll_archived_days_once, rollup_day, rollup_month, rollup_recent_months, run_log_retention_once, SITE_SCOPE, vacuum_if_worthwhile } from './log-retention-cron'
import { CLIENT_LOG_COLUMNS, open_logs_db } from './logs-db'
import { open_test_shared_db } from './shared-db'

let shared_db: Database.Database
let logs_db: Database.Database
let archive_db: Database.Database

beforeEach(() => {
  shared_db = open_test_shared_db()
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
    expect(normalize_route('/my-dict-id')).toBe('dictionary:home')
    expect(normalize_route('/my-dict-id/entries')).toBe('dictionary:entries')
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

  test('excludes admin (level >= 2) sessions from the geo tally, keeps them everywhere else, and stores user_id', async () => {
    const { ADMINS } = await import('$lib/admins')
    const admin_email = ADMINS[0].email
    shared_db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run('admin1', admin_email)
    // Admin session in US-CA + a normal visitor also in US-CA.
    add_log({ message: 'session_start', user_id: 'admin1', context: { session_id: 'sa' }, geo: { country: 'US', region: 'CA', city: null, latitude: null, longitude: null } })
    add_log({ message: 'session_start', user_id: 'u9', context: { session_id: 'su' }, geo: { country: 'US', region: 'CA', city: null, latitude: null, longitude: null } })

    rollup_day({ day: '2026-06-01', shared_db, logs_db })

    // Geo counts only the non-admin visitor; sessions/users still count the admin.
    expect(metric('2026-06-01', 'geo:US-CA')).toBe(1)
    expect(metric('2026-06-01', 'sessions')).toBe(2)
    expect(metric('2026-06-01', 'users')).toBe(2)
    // user_id is materialized so the live reader can exclude admins on hot days too.
    const admin_session = shared_db.prepare(`SELECT user_id FROM log_daily_sessions WHERE day = '2026-06-01' AND session_id = 'sa'`).get() as { user_id: string | null }
    expect(admin_session.user_id).toBe('admin1')
  })

  test('counts a user with both client and server rows once (no cross-source double count)', () => {
    // Same user appears in a browser session AND a server-attributed row the same day.
    add_log({ message: 'session_start', user_id: 'u1', context: { session_id: 's1' } })
    add_log({ level: 'error', message: 'srv boom', user_id: 'u1', source: 'server', context: null })

    rollup_day({ day: '2026-06-01', shared_db, logs_db })

    // Exactly ONE `users` row (canonical `client` source), value 1 — NOT one row per
    // source summing to 2 in the reader's per-day SUM.
    const rows = shared_db.prepare(`SELECT source, value FROM log_daily_metrics WHERE day = '2026-06-01' AND metric = 'users'`).all()
    expect(rows).toEqual([{ source: 'client', value: 1 }])
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

  test('rolls up per-dictionary viewership (distinct human sessions + anon subset; bots excluded)', () => {
    // Dict A: two distinct human sessions — one anon (no user_id), one signed-in.
    add_log({ message: 'dictionary_opened', context: { session_id: 'anon1', dictionary_id: 'dictA' } })
    add_log({ message: 'entry_opened', context: { session_id: 'anon1', dictionary_id: 'dictA', entry_id: 'e1' } })
    add_log({ message: 'dictionary_opened', user_id: 'u1', context: { session_id: 'auth1', dictionary_id: 'dictA' } })
    // Same anon session opening it again the same day must NOT double-count.
    add_log({ message: 'dictionary_opened', context: { session_id: 'anon1', dictionary_id: 'dictA' } })
    // Dict B: one anon human session.
    add_log({ message: 'dictionary_opened', context: { session_id: 'anon1', dictionary_id: 'dictB' } })
    // A bot opening dict A must be excluded entirely.
    const HEADLESS = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36'
    add_log({ message: 'dictionary_opened', context: { session_id: 'bot1', dictionary_id: 'dictA' }, user_agent: HEADLESS })

    rollup_day({ day: '2026-06-01', shared_db, logs_db })

    // No visitor_id in these rows → visitor key falls back to session_id, so
    // visitors == sessions (the pre-rollout behavior).
    const views = shared_db.prepare(`SELECT dictionary_id, sessions, anon_sessions, visitors, anon_visitors FROM dictionary_daily_views WHERE day = ? ORDER BY dictionary_id`).all('2026-06-01') as { dictionary_id: string, sessions: number, anon_sessions: number, visitors: number, anon_visitors: number }[]
    expect(views).toEqual([
      { dictionary_id: 'dictA', sessions: 2, anon_sessions: 1, visitors: 2, anon_visitors: 1 }, // anon1 + auth1; anon subset = anon1
      { dictionary_id: 'dictB', sessions: 1, anon_sessions: 1, visitors: 1, anon_visitors: 1 },
    ])
  })

  test('counts distinct persistent visitor_id as ONE visitor across multiple sessions (visits > visitors)', () => {
    // One person (visitor v1) visits dictA twice — two page loads = two sessions,
    // but the same persistent visitor_id. Visits = 2, Visitors = 1.
    add_log({ message: 'dictionary_opened', context: { session_id: 's1', visitor_id: 'v1', dictionary_id: 'dictA' } })
    add_log({ message: 'dictionary_opened', context: { session_id: 's2', visitor_id: 'v1', dictionary_id: 'dictA' } })
    // A second, different person (visitor v2) visits once.
    add_log({ message: 'dictionary_opened', context: { session_id: 's3', visitor_id: 'v2', dictionary_id: 'dictA' } })

    rollup_day({ day: '2026-06-01', shared_db, logs_db })

    const row = shared_db.prepare(`SELECT sessions, anon_sessions, visitors, anon_visitors FROM dictionary_daily_views WHERE day = '2026-06-01' AND dictionary_id = 'dictA'`).get() as { sessions: number, anon_sessions: number, visitors: number, anon_visitors: number }
    expect(row).toEqual({ sessions: 3, anon_sessions: 3, visitors: 2, anon_visitors: 2 })
  })

  test('per-dictionary viewership is idempotent (full-day REPLACE, no doubling)', () => {
    add_log({ message: 'dictionary_opened', context: { session_id: 's1', dictionary_id: 'dictA' } })
    rollup_day({ day: '2026-06-01', shared_db, logs_db })
    rollup_day({ day: '2026-06-01', shared_db, logs_db })
    const row = shared_db.prepare(`SELECT sessions FROM dictionary_daily_views WHERE day = '2026-06-01' AND dictionary_id = 'dictA'`).get() as { sessions: number } | undefined
    expect(row?.sessions).toBe(1)
    expect((shared_db.prepare(`SELECT COUNT(*) n FROM dictionary_daily_views WHERE day = '2026-06-01'`).get() as { n: number }).n).toBe(1)
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

const HEADLESS_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36'

describe(prev_month, () => {
  test('steps back a calendar month, crossing a year boundary', () => {
    expect(prev_month('2026-07')).toBe('2026-06')
    expect(prev_month('2026-01')).toBe('2025-12')
  })
})

describe(rollup_month, () => {
  test('counts TRUE monthly-unique visitors (union across days), per-dict + site, bots excluded', () => {
    // Visitor v1 (anonymous) opens dictA on TWO different days → ONE monthly visitor
    // (union), TWO visits. This is the whole point vs daily-distinct "visitor-days".
    add_log({ day: '2026-06-01', message: 'session_start', context: { session_id: 's1', visitor_id: 'v1' } })
    add_log({ day: '2026-06-01', message: 'dictionary_opened', context: { session_id: 's1', visitor_id: 'v1', dictionary_id: 'dictA' } })
    add_log({ day: '2026-06-10', message: 'session_start', context: { session_id: 's2', visitor_id: 'v1' } })
    add_log({ day: '2026-06-10', message: 'dictionary_opened', context: { session_id: 's2', visitor_id: 'v1', dictionary_id: 'dictA' } })
    // A second, SIGNED-IN visitor v2 opens dictA once.
    add_log({ day: '2026-06-05', message: 'session_start', user_id: 'u2', context: { session_id: 's3', visitor_id: 'v2' } })
    add_log({ day: '2026-06-05', message: 'dictionary_opened', user_id: 'u2', context: { session_id: 's3', visitor_id: 'v2', dictionary_id: 'dictA' } })
    // A bot opens dictA — excluded via log_daily_sessions UA classification.
    add_log({ day: '2026-06-02', message: 'session_start', context: { session_id: 'bot1', visitor_id: 'vb' }, user_agent: HEADLESS_UA })
    add_log({ day: '2026-06-02', message: 'dictionary_opened', context: { session_id: 'bot1', visitor_id: 'vb', dictionary_id: 'dictA' }, user_agent: HEADLESS_UA })

    // Populate log_daily_sessions (the bot-classification + anon source) for each day.
    for (const day of ['2026-06-01', '2026-06-02', '2026-06-05', '2026-06-10'])
      rollup_day({ day, shared_db, logs_db })

    rollup_month({ month: '2026-06', shared_db, logs_db, archive_db })

    const dictA = shared_db.prepare(`SELECT visits, anon_visits, visitors, anon_visitors FROM dictionary_monthly_visitors WHERE month = '2026-06' AND scope = 'dictA'`).get()
    // visits = s1,s2,s3 (bot excluded) = 3; anon_visits = s1,s2 = 2;
    // visitors = v1,v2 = 2 (v1 counted ONCE despite two days); anon_visitors = v1 = 1.
    expect(dictA).toEqual({ visits: 3, anon_visits: 2, visitors: 2, anon_visitors: 1 })

    const site = shared_db.prepare(`SELECT visits, visitors, anon_visitors FROM dictionary_monthly_visitors WHERE month = '2026-06' AND scope = ?`).get(SITE_SCOPE)
    // site (session_start): s1,s2,s3 → visits 3; visitors v1,v2 = 2; anon_visitors v1 = 1.
    expect(site).toEqual({ visits: 3, visitors: 2, anon_visitors: 1 })
  })

  test('is idempotent (full-month REPLACE, no doubling)', () => {
    add_log({ day: '2026-06-01', message: 'session_start', context: { session_id: 's1', visitor_id: 'v1' } })
    rollup_day({ day: '2026-06-01', shared_db, logs_db })
    rollup_month({ month: '2026-06', shared_db, logs_db, archive_db })
    rollup_month({ month: '2026-06', shared_db, logs_db, archive_db })
    const site = shared_db.prepare(`SELECT visitors FROM dictionary_monthly_visitors WHERE month = '2026-06' AND scope = ?`).get(SITE_SCOPE) as { visitors: number }
    expect(site.visitors).toBe(1)
    expect((shared_db.prepare(`SELECT COUNT(*) n FROM dictionary_monthly_visitors WHERE month = '2026-06' AND scope = ?`).get(SITE_SCOPE) as { n: number }).n).toBe(1)
  })

  test('reads across hot + archive so a month spanning the storage boundary is whole', () => {
    // Same visitor, one session in hot logs, one in the archive file, same month.
    add_log({ day: '2026-06-20', message: 'dictionary_opened', context: { session_id: 's-hot', visitor_id: 'v1', dictionary_id: 'dictA' }, db: logs_db })
    add_log({ day: '2026-06-02', message: 'dictionary_opened', context: { session_id: 's-arc', visitor_id: 'v1', dictionary_id: 'dictA' }, db: archive_db })
    rollup_day({ day: '2026-06-20', shared_db, logs_db })
    rollup_day({ day: '2026-06-02', shared_db, logs_db: archive_db })
    rollup_month({ month: '2026-06', shared_db, logs_db, archive_db })
    const dictA = shared_db.prepare(`SELECT visits, visitors FROM dictionary_monthly_visitors WHERE month = '2026-06' AND scope = 'dictA'`).get()
    expect(dictA).toEqual({ visits: 2, visitors: 1 })
  })
})

describe(rollup_recent_months, () => {
  test('rolls every recent month and freezes completed ones via the watermark', () => {
    add_log({ day: '2026-06-15', message: 'session_start', context: { session_id: 's1', visitor_id: 'v1' } })
    rollup_day({ day: '2026-06-15', shared_db, logs_db })
    // "Now" is in July → June is complete and should freeze.
    rollup_recent_months({ shared_db, logs_db, archive_db, now: new Date('2026-07-03T00:00:00.000Z') })
    expect((shared_db.prepare(`SELECT value FROM db_metadata WHERE key = ?`).get(MONTHLY_FINALIZED_KEY) as { value: string }).value).toBe('2026-06')
    const site = shared_db.prepare(`SELECT visitors FROM dictionary_monthly_visitors WHERE month = '2026-06' AND scope = ?`).get(SITE_SCOPE) as { visitors: number }
    expect(site.visitors).toBe(1)
  })

  test('does NOT finalize the current month when no earlier month has rolled', () => {
    add_log({ day: '2026-07-02', message: 'session_start', context: { session_id: 's1', visitor_id: 'v1' } })
    rollup_day({ day: '2026-07-02', shared_db, logs_db })
    rollup_recent_months({ shared_db, logs_db, archive_db, now: new Date('2026-07-03T00:00:00.000Z') })
    expect(shared_db.prepare(`SELECT value FROM db_metadata WHERE key = ?`).get(MONTHLY_FINALIZED_KEY)).toBeUndefined()
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

describe(vacuum_if_worthwhile, () => {
  test('vacuums when the freelist crosses the reclaimable threshold and skips when it does not', () => {
    // Bulk-insert then delete so the freelist holds real reclaimable pages.
    const filler = 'x'.repeat(2000)
    for (let index = 0; index < 200; index++)
      add_log({ day: '2026-06-01', message: `bulk ${index} ${filler}` })
    logs_db.prepare('DELETE FROM client_logs').run()
    const freelist_before = logs_db.pragma('freelist_count', { simple: true }) as number
    // eslint-disable-next-line no-restricted-syntax -- genuine range check on freed page count
    expect(freelist_before).toBeGreaterThan(0)

    // Guard holds: thresholds far above what the delete freed → no VACUUM.
    const skipped = vacuum_if_worthwhile({ db: logs_db, label: 'logs.db', min_reclaimable_bytes: 1024 * 1024 * 1024 })
    expect(skipped.vacuumed).toBeFalsy()
    expect(logs_db.pragma('freelist_count', { simple: true })).toBe(freelist_before)

    // Guard passes: tiny thresholds → VACUUM runs and empties the freelist.
    const vacuumed = vacuum_if_worthwhile({ db: logs_db, label: 'logs.db', min_reclaimable_bytes: 1 })
    expect(vacuumed.vacuumed).toBeTruthy()
    expect(vacuumed.reclaimable_bytes).toBe(freelist_before * (logs_db.pragma('page_size', { simple: true }) as number))
    expect(logs_db.pragma('freelist_count', { simple: true })).toBe(0)
  })

  test('fraction rule needs at least 8 MB reclaimable, so small dbs never vacuum', () => {
    add_log({ day: '2026-06-01', message: 'one row' })
    logs_db.prepare('DELETE FROM client_logs').run()
    // Nearly 100% of this tiny db is reclaimable, but it is far under 8 MB.
    const result = vacuum_if_worthwhile({ db: logs_db, label: 'logs.db' })
    expect(result.vacuumed).toBeFalsy()
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

  test('a failure in one sub-step does not abort the rest of the sweep', () => {
    // Regression for the 2026-07-05 house incident (ported to LD): the runs-first,
    // unconditional reroll_archived_days_once threw and aborted the ENTIRE sweep —
    // no rollup, no archive marker — every pass. Simulate a broken archive DB (its
    // client_logs table is gone) so BOTH the reroll heal and archive_old_logs throw,
    // and prove the hot-day rollup + run marker still land.
    const now = new Date('2026-06-30T00:00:00.000Z')
    add_log({ day: '2026-06-29', message: 'heartbeat', context: { session_id: 's1' } })
    archive_db.exec('DROP TABLE client_logs') // reroll + archive steps will now throw

    let result: ReturnType<typeof run_log_retention_once> | undefined
    expect(() => { result = run_log_retention_once({ shared_db, logs_db, archive_db, now }) }).not.toThrow()

    // Archive step failed → its counts fall back to 0, but the sweep continued.
    expect(result?.archived).toBe(0)
    // The ordinary hot-day rollup still ran.
    expect(metric('2026-06-29', 'sessions')).toBe(1)
    // And the run marker was still recorded (record_ran_at ran after the failures).
    const marker = shared_db.prepare(`SELECT value FROM db_metadata WHERE key = 'log_retention_ran_at'`).get() as { value: string } | undefined
    expect(marker?.value).toBe(now.toISOString())
    // All three archive-touching steps (reroll + rollup_recent_months + archive)
    // logged a server event into logs.db instead of throwing out of the sweep.
    const step_failures = logs_db.prepare(`SELECT COUNT(*) n FROM client_logs WHERE message = 'log_retention_step_failed'`).get() as { n: number }
    expect(step_failures.n).toBe(3)
  })
})

describe(open_log_archive_db, () => {
  test('retrofits ALL columns missing from an old-schema archive file (not just session_id)', () => {
    // An archive file created before the geo columns (country/region/city/lat/long)
    // AND before session_id existed. The retention sweep's reroll heal reads those
    // columns by name against the archive DB — a missing column 500s the whole
    // sweep (the 2026-07-05 house bug), so open must ALTER-ADD every missing column.
    const dir = mkdtempSync(join(tmpdir(), 'ld-archive-retrofit-'))
    const path = join(dir, 'logs-archive.db')
    try {
      // Pre-geo, pre-session_id schema — the shape a pre-split archive file had.
      const old = new BetterSqlite3(path)
      old.exec(`
        CREATE TABLE client_logs (
          id TEXT PRIMARY KEY,
          received_at TEXT NOT NULL,
          client_time TEXT,
          user_id TEXT,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          stack TEXT,
          url TEXT,
          user_agent TEXT,
          platform TEXT,
          app_version TEXT,
          build_target TEXT,
          context TEXT,
          source TEXT
        );
      `)
      old.prepare(`INSERT INTO client_logs (id, received_at, level, message) VALUES ('old-1', '2026-06-10T00:00:00.000Z', 'info', 'heartbeat')`).run()
      old.close()

      const db = open_log_archive_db(path)
      const columns = (db.prepare(`SELECT name FROM pragma_table_info('client_logs')`).all() as { name: string }[]).map(row => row.name)
      for (const column of CLIENT_LOG_COLUMNS)
        expect(columns).toContain(column)

      // The pre-existing row survives, and a rollup that reads the geo columns by
      // name no longer throws (the exact query reroll_archived_days_once runs).
      expect(() => rollup_day({ day: '2026-06-10', shared_db, logs_db: db })).not.toThrow()
      expect((db.prepare('SELECT COUNT(*) n FROM client_logs').get() as { n: number }).n).toBe(1)
      db.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('is a no-op on an already-current archive file (adds nothing, keeps rows)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ld-archive-current-'))
    const path = join(dir, 'logs-archive.db')
    try {
      const first = open_log_archive_db(path)
      first.prepare(`INSERT INTO client_logs (id, received_at, level, message, country) VALUES ('c-1', '2026-06-10T00:00:00.000Z', 'info', 'heartbeat', 'US')`).run()
      first.close()

      const again = open_log_archive_db(path)
      const columns = (again.prepare(`SELECT name FROM pragma_table_info('client_logs')`).all() as { name: string }[]).map(row => row.name)
      expect(columns).toHaveLength(CLIENT_LOG_COLUMNS.length)
      expect((again.prepare(`SELECT country FROM client_logs WHERE id = 'c-1'`).get() as { country: string }).country).toBe('US')
      again.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
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
