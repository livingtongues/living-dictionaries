import type Database from 'better-sqlite3'
import type { RequestGeo } from '$lib/server/geo-from-request'
import { insert_client_log } from '$lib/server/insert-client-log'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_log_archive_db } from './log-archive-db'
import { archive_old_logs, normalize_route, rollup_day, run_log_retention_once } from './log-retention-cron'
import { open_shared_db } from './shared-db'

let shared_db: Database.Database
let archive_db: Database.Database

beforeEach(() => {
  shared_db = open_shared_db(':memory:')
  archive_db = open_log_archive_db(':memory:')
})

afterEach(() => {
  shared_db.close()
  archive_db.close()
})

function add_log({ day = '2026-06-01', time = '12:00:00', level = 'info', message = 'heartbeat', source = 'client', user_id = null, context = null, user_agent = null, geo }: {
  day?: string
  time?: string
  level?: 'error' | 'warn' | 'info' | 'unhandled_rejection' | 'crash'
  message?: string
  source?: 'client' | 'server'
  user_id?: string | null
  context?: Record<string, unknown> | null
  user_agent?: string | null
  geo?: RequestGeo
}): void {
  insert_client_log({
    payload: { level, message, context, user_agent },
    user_id,
    source,
    ...(geo ? { geo } : {}),
    db: shared_db,
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
  test('aggregates sessions, users, errors, levels, events, nav buckets, and geo per source', () => {
    add_log({ message: 'session_start', user_id: 'u1', context: { session_id: 's1' }, geo: { country: 'US', region: 'CA', city: null, latitude: null, longitude: null } })
    add_log({ message: 'heartbeat', user_id: 'u1', context: { session_id: 's1' }, geo: { country: 'US', region: 'CA', city: null, latitude: null, longitude: null } })
    add_log({ message: 'navigation', user_id: 'u1', context: { session_id: 's1', to: '/dictionaries' } })
    add_log({ message: 'navigation', user_id: 'u1', context: { session_id: 's1', to: '/my-dict/entries/x' } })
    add_log({ message: 'search_performed', user_id: 'u1', context: { session_id: 's1', query: 'esot' } })
    add_log({ level: 'error', message: 'boom', user_id: null, context: { session_id: 's2' }, geo: { country: 'GB', region: null, city: null, latitude: null, longitude: null } })
    add_log({ level: 'error', message: 'srv', source: 'server', context: null })

    const { metrics_written } = rollup_day({ day: '2026-06-01', shared_db })
    expect(metrics_written).toBeTruthy()

    expect(metric('2026-06-01', 'sessions')).toBe(2)
    expect(metric('2026-06-01', 'users')).toBe(1)
    expect(metric('2026-06-01', 'errors')).toBe(1)
    expect(metric('2026-06-01', 'logs')).toBe(6)
    expect(metric('2026-06-01', 'event:search_performed')).toBe(1)
    expect(metric('2026-06-01', 'nav:dictionaries')).toBe(1)
    expect(metric('2026-06-01', 'nav:dictionary:entry')).toBe(1)
    // Geo: distinct sessions per area (region key, country fallback).
    expect(metric('2026-06-01', 'geo:US-CA')).toBe(1)
    expect(metric('2026-06-01', 'geo:GB')).toBe(1)

    expect(metric('2026-06-01', 'errors', 'server')).toBe(1)
    expect(metric('2026-06-01', 'logs', 'server')).toBe(1)
  })

  test('is idempotent — re-running overwrites, never doubles', () => {
    add_log({ message: 'heartbeat', context: { session_id: 's1' } })
    rollup_day({ day: '2026-06-01', shared_db })
    rollup_day({ day: '2026-06-01', shared_db })
    expect(metric('2026-06-01', 'logs')).toBe(1)
  })

  test('splits bot/headless rows into a parallel bot: namespace (human metrics unaffected; server rows kept)', () => {
    const HEADLESS = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36'
    // Human session.
    add_log({ message: 'session_start', user_id: 'human', context: { session_id: 'h1' }, user_agent: 'Mozilla/5.0 Chrome/148' })
    add_log({ message: 'search_performed', user_id: 'human', context: { session_id: 'h1' }, user_agent: 'Mozilla/5.0 Chrome/148' })
    // Bot session — contributes only to the `bot:` namespace, never the human metrics.
    add_log({ message: 'session_start', context: { session_id: 'b1' }, user_agent: HEADLESS })
    add_log({ message: 'search_performed', context: { session_id: 'b1' }, user_agent: HEADLESS })
    // Server row (NULL user_agent) — kept as human/plain.
    add_log({ message: 'auth_login', source: 'server' })

    rollup_day({ day: '2026-06-01', shared_db })
    // Human (plain) metrics exclude bots.
    expect(metric('2026-06-01', 'sessions')).toBe(1) // only the human session
    expect(metric('2026-06-01', 'users')).toBe(1)
    expect(metric('2026-06-01', 'event:search_performed')).toBe(1)
    expect(metric('2026-06-01', 'logs')).toBe(2) // 2 human rows
    expect(metric('2026-06-01', 'logs', 'server')).toBe(1) // server row kept
    // Bots are preserved under the `bot:` namespace (so the Bots toggle works on cold days).
    expect(metric('2026-06-01', 'bot:sessions')).toBe(1)
    expect(metric('2026-06-01', 'bot:event:search_performed')).toBe(1)
    expect(metric('2026-06-01', 'bot:logs')).toBe(2)
  })
})

describe(archive_old_logs, () => {
  test('moves rows older than the hot window and prunes the archive past its window', () => {
    const now = new Date('2026-06-30T00:00:00.000Z')
    add_log({ day: '2026-06-29', message: 'recent' })
    add_log({ day: '2026-06-10', message: 'aged' })
    add_log({ day: '2026-03-01', message: 'ancient' })

    const { archived } = archive_old_logs({ shared_db, archive_db, now })
    expect(archived).toBe(2)

    const hot = shared_db.prepare('SELECT message FROM client_logs').all() as { message: string }[]
    expect(hot.map(r => r.message)).toEqual(['recent'])

    const archived_rows = archive_db.prepare('SELECT message FROM client_logs ORDER BY message').all() as { message: string }[]
    expect(archived_rows.map(r => r.message)).toEqual(['aged'])
  })
})

describe(run_log_retention_once, () => {
  test('rolls up every hot day then archives, recording a run marker', () => {
    const now = new Date('2026-06-30T00:00:00.000Z')
    add_log({ day: '2026-06-29', message: 'heartbeat', context: { session_id: 's1' } })
    add_log({ day: '2026-06-10', message: 'heartbeat', context: { session_id: 's2' } })

    const result = run_log_retention_once({ shared_db, archive_db, now })
    expect(result.days_rolled).toBe(2)
    expect(result.archived).toBe(1)

    expect(metric('2026-06-29', 'sessions')).toBe(1)
    expect(metric('2026-06-10', 'sessions')).toBe(1)

    const marker = shared_db.prepare(`SELECT value FROM db_metadata WHERE key = 'log_retention_ran_at'`).get() as { value: string }
    expect(marker.value).toBe(now.toISOString())
  })
})
