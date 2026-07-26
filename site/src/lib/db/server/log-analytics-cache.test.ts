import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { insert_client_log } from '$lib/server/insert-client-log'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { clear_log_analytics_cache, get_log_analytics } from './log-analytics'
import { ROLLUP_WATERMARK_KEY } from './log-retention-cron'
import { get_logs_db, open_logs_db } from './logs-db'
import { get_shared_db, open_test_shared_db } from './shared-db'

/**
 * The DEFAULT-argument path of `get_log_analytics` — the only path that touches
 * the stale-while-revalidate cache (see `$lib/server/watermark-swr-cache` for
 * the controller's own behavioral suite). `get_logs_db()` is already in-memory
 * under vitest, but shared.db/logs-archive.db are DATA_DIR files, so point
 * DATA_DIR at a temp dir BEFORE the first call opens those singletons.
 */
const NOW = new Date('2026-07-24T12:00:00.000Z')
let data_dir: string
let previous_data_dir: string | undefined

beforeAll(() => {
  data_dir = mkdtempSync(join(tmpdir(), 'ld-analytics-swr-'))
  previous_data_dir = process.env.DATA_DIR
  process.env.DATA_DIR = data_dir
})

afterAll(() => {
  clear_log_analytics_cache()
  rmSync(data_dir, { recursive: true, force: true })
  if (previous_data_dir === undefined)
    delete process.env.DATA_DIR
  else
    process.env.DATA_DIR = previous_data_dir
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  clear_log_analytics_cache()
  get_logs_db().exec(`DELETE FROM client_logs`)
  get_shared_db().prepare(`DELETE FROM db_metadata WHERE key = ?`).run(ROLLUP_WATERMARK_KEY)
  return () => vi.useRealTimers()
})

function add_session(session_id: string): void {
  insert_client_log({
    payload: { level: 'info', message: 'session_start', context: { session_id } },
    user_id: null,
    source: 'client',
    db: get_logs_db(),
    now: new Date(),
  })
}

function set_rollup_watermark(day: string): void {
  get_shared_db().prepare(`
    INSERT INTO db_metadata (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(ROLLUP_WATERMARK_KEY, day)
}

describe('log analytics stale-while-revalidate wiring', () => {
  test('memoizes the default-arg window and reports compute cost only when it actually computes', () => {
    const on_computed = vi.fn()

    const first = get_log_analytics({ days: 30, audience: 'humans', scope: 'light', on_computed })
    vi.setSystemTime(new Date(NOW.getTime() + 20 * 60_000))
    const second = get_log_analytics({ days: 30, audience: 'humans', scope: 'light', on_computed })

    expect(first.generated_at).toBe(NOW.toISOString())
    expect(second.generated_at).toBe(NOW.toISOString())
    expect(on_computed).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('each key (days/audience/scope) is cached independently', () => {
    get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })
    vi.setSystemTime(new Date(NOW.getTime() + 60_000))
    const other_audience = get_log_analytics({ days: 30, audience: 'bots', scope: 'light' })
    const other_scope = get_log_analytics({ days: 7, audience: 'humans', scope: 'light' })

    expect(other_audience.generated_at).toBe(new Date().toISOString())
    expect(other_scope.generated_at).toBe(new Date().toISOString())
    expect(get_log_analytics({ days: 30, audience: 'humans', scope: 'light' }).generated_at).toBe(NOW.toISOString())
  })

  test('serves stale instantly with FRESH pipeline liveness, then refreshes once after the watermark advances', () => {
    expect(get_log_analytics({ days: 30, audience: 'humans', scope: 'light' }).totals.sessions).toBe(0)

    vi.setSystemTime(new Date(NOW.getTime() + 30 * 60_000))
    add_session('s1')
    const before_watermark = get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })

    // Body is the cached blob, but the ingest-liveness panel is recomputed now.
    expect(before_watermark.generated_at).toBe(NOW.toISOString())
    expect(before_watermark.totals.sessions).toBe(0)
    expect(before_watermark.pipeline.hot_rows).toBe(1)
    expect(before_watermark.pipeline.last_log_at).toBe(new Date().toISOString())
    expect(vi.getTimerCount()).toBe(0)

    set_rollup_watermark('2026-07-23')
    const stale = get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })
    get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })

    expect(stale.generated_at).toBe(NOW.toISOString())
    expect(vi.getTimerCount()).toBe(1) // single-flight: two stale reads, one refresh

    vi.runOnlyPendingTimers()
    const refreshed = get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })

    expect(refreshed.generated_at).toBe(new Date().toISOString())
    expect(refreshed.totals.sessions).toBe(1)
    expect(vi.getTimerCount()).toBe(0) // refreshed AT the new watermark
  })

  test('an injected db/now bypasses the cache entirely', () => {
    const shared_db = open_test_shared_db()
    const logs_db = open_logs_db(':memory:')
    const on_computed = vi.fn()

    get_log_analytics({ shared_db, logs_db, days: 30, now: NOW, scope: 'light', on_computed })
    get_log_analytics({ shared_db, logs_db, days: 30, now: NOW, scope: 'light', on_computed })
    // ...and nothing about the injected call leaks into the live-handle cache.
    vi.setSystemTime(new Date(NOW.getTime() + 90_000))
    const live = get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })

    expect(on_computed).toHaveBeenCalledTimes(2)
    expect(live.generated_at).toBe(new Date().toISOString())

    shared_db.close()
    logs_db.close()
  })

  test('clearing during an in-flight refresh does not repopulate the cache', () => {
    get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })
    set_rollup_watermark('2026-07-23')
    get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })

    clear_log_analytics_cache()
    vi.runOnlyPendingTimers() // the invalidated refresh completes here

    vi.setSystemTime(new Date(NOW.getTime() + 45 * 60_000))
    const after_clear = get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })

    expect(after_clear.generated_at).toBe(new Date().toISOString())
  })
})
