import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { insert_client_log } from '$lib/server/insert-client-log'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { await_pending_analytics_computes, clear_log_analytics_cache, get_log_analytics, warm_analytics_caches } from './log-analytics'
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
  // Fake the CLOCK only. The compute is now stage-chunked (it awaits
  // `breathe()`/`setImmediate` between stages) and background refreshes ride
  // `setTimeout`, so faking timers too would deadlock every await in here.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  clear_log_analytics_cache()
  rmSync(join(data_dir, 'analytics-cache'), { recursive: true, force: true })
  get_logs_db().exec(`DELETE FROM client_logs`)
  get_shared_db().prepare(`DELETE FROM db_metadata WHERE key = ?`).run(ROLLUP_WATERMARK_KEY)
  return () => vi.useRealTimers()
})

/**
 * Let a scheduled background refresh start (one real macrotask) and then finish.
 * `settle()` alone isn't enough: a refresh scheduled by a stale read hasn't
 * begun computing yet, so there is nothing in flight to await.
 */
async function run_background_refresh(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
  await await_pending_analytics_computes()
}

function persisted_cache_files(): string[] {
  try {
    return readdirSync(join(data_dir, 'analytics-cache'))
  } catch {
    return []
  }
}

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
  test('memoizes the default-arg window and reports compute cost only when it actually computes', async () => {
    const on_computed = vi.fn()

    const first = await get_log_analytics({ days: 30, audience: 'humans', scope: 'light', on_computed })
    vi.setSystemTime(new Date(NOW.getTime() + 20 * 60_000))
    const second = await get_log_analytics({ days: 30, audience: 'humans', scope: 'light', on_computed })

    expect(first.generated_at).toBe(NOW.toISOString())
    expect(second.generated_at).toBe(NOW.toISOString())
    expect(on_computed).toHaveBeenCalledTimes(1)
    expect(on_computed.mock.calls[0][0].stages.build_daily_series).toBeTypeOf('number')
  })

  test('the compute yields the event loop between stages instead of blocking end to end', async () => {
    const served_during_compute: string[] = []

    const compute = get_log_analytics({ days: 30, audience: 'humans', scope: 'diagnostics' })
    // Stand in for another request arriving while the dashboard computes. Before
    // 2026-07-27 this could not run until the whole aggregation finished — which
    // is how a 27–80 s compute turned real users' syncs into HTTP 502s.
    setImmediate(() => served_during_compute.push('other-request'))
    await compute

    expect(served_during_compute).toEqual(['other-request'])
  })

  test('a computed payload is mirrored to disk so a restart never pays for a cold compute', async () => {
    await get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })

    expect(persisted_cache_files()).toEqual(['30-humans-light.json'])
  })

  test('each key (days/audience/scope) is cached independently', async () => {
    await get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })
    vi.setSystemTime(new Date(NOW.getTime() + 60_000))
    const other_audience = await get_log_analytics({ days: 30, audience: 'bots', scope: 'light' })
    const other_scope = await get_log_analytics({ days: 7, audience: 'humans', scope: 'light' })

    expect(other_audience.generated_at).toBe(new Date().toISOString())
    expect(other_scope.generated_at).toBe(new Date().toISOString())
    expect((await get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })).generated_at).toBe(NOW.toISOString())
  })

  test('serves stale instantly with FRESH pipeline liveness, then refreshes once after the watermark advances', async () => {
    expect((await get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })).totals.sessions).toBe(0)

    vi.setSystemTime(new Date(NOW.getTime() + 30 * 60_000))
    add_session('s1')
    const before_watermark = await get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })

    // Body is the cached blob, but the ingest-liveness panel is recomputed now.
    expect(before_watermark.generated_at).toBe(NOW.toISOString())
    expect(before_watermark.totals.sessions).toBe(0)
    expect(before_watermark.pipeline.hot_rows).toBe(1)
    expect(before_watermark.pipeline.last_log_at).toBe(new Date().toISOString())

    set_rollup_watermark('2026-07-23')
    const on_computed = vi.fn()
    const stale = await get_log_analytics({ days: 30, audience: 'humans', scope: 'light', on_computed })
    await get_log_analytics({ days: 30, audience: 'humans', scope: 'light', on_computed })

    expect(stale.generated_at).toBe(NOW.toISOString())

    await run_background_refresh()
    const refreshed = await get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })

    expect(on_computed).toHaveBeenCalledTimes(1) // single-flight: two stale reads, ONE refresh
    expect(refreshed.generated_at).toBe(new Date().toISOString())
    expect(refreshed.totals.sessions).toBe(1)
  })

  test('concurrent COLD misses adopt one compute instead of each paying full price', async () => {
    const on_computed = vi.fn()

    const [first, second, third] = await Promise.all([
      get_log_analytics({ days: 30, audience: 'humans', scope: 'light', on_computed }),
      get_log_analytics({ days: 30, audience: 'humans', scope: 'light', on_computed }),
      get_log_analytics({ days: 30, audience: 'humans', scope: 'light', on_computed }),
    ])

    // The 2026-07-24 18:18 production pair: two simultaneous first visits each
    // ran the whole compute. Now they share one.
    expect(on_computed).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  test('warming off the request path arms every landing key, so a human visit never computes', async () => {
    await warm_analytics_caches()

    const on_computed = vi.fn()
    await get_log_analytics({ days: 30, audience: 'humans', scope: 'light', on_computed })
    await get_log_analytics({ days: 30, audience: 'humans', scope: 'usage', on_computed })
    await get_log_analytics({ days: 30, audience: 'humans', scope: 'diagnostics', on_computed })

    expect(on_computed).not.toHaveBeenCalled()
  })

  test('an injected db/now bypasses the cache entirely', async () => {
    const shared_db = open_test_shared_db()
    const logs_db = open_logs_db(':memory:')
    const on_computed = vi.fn()

    await get_log_analytics({ shared_db, logs_db, days: 30, now: NOW, scope: 'light', on_computed })
    await get_log_analytics({ shared_db, logs_db, days: 30, now: NOW, scope: 'light', on_computed })
    // ...and nothing about the injected call leaks into the live-handle cache.
    vi.setSystemTime(new Date(NOW.getTime() + 90_000))
    const live = await get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })

    expect(on_computed).toHaveBeenCalledTimes(2)
    expect(live.generated_at).toBe(new Date().toISOString())

    shared_db.close()
    logs_db.close()
  })

  test('clearing during an in-flight refresh does not repopulate the cache', async () => {
    await get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })
    set_rollup_watermark('2026-07-23')
    await get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })

    clear_log_analytics_cache()
    await run_background_refresh() // the invalidated refresh completes here

    vi.setSystemTime(new Date(NOW.getTime() + 45 * 60_000))
    const after_clear = await get_log_analytics({ days: 30, audience: 'humans', scope: 'light' })

    expect(after_clear.generated_at).toBe(new Date().toISOString())
  })
})
