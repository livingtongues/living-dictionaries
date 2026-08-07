import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { get_cron_runtimes, next_daily_at, OVERDUE_SPACING_MS, QUIET_AFTER_BOOT_MS, start_crons_once, stop_all_crons } from './cron-scheduler'
import type { CronDef } from './cron-scheduler'
import { minutes, seconds } from './crons'

const { env_mock } = vi.hoisted(() => ({ env_mock: {} as Record<string, string | undefined> }))
vi.mock('$env/dynamic/private', () => ({ env: env_mock }))
// `version` is read by `insert-client-log` (build-identity resolution at ingest),
// which the roster reaches through `log-server-event` — a partial mock 500s the suite.
vi.mock('$app/environment', () => ({ building: false, dev: false, browser: false, version: 'test' }))

let db: ReturnType<typeof open_test_shared_db>

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'))
  db = open_test_shared_db()
  for (const key of Object.keys(env_mock))
    delete env_mock[key]
})
afterEach(() => {
  stop_all_crons()
  db.close()
  vi.useRealTimers()
})

function def(overrides: Partial<CronDef> & { name: string }): CronDef {
  return { description: 'test cron', every_ms: minutes(30), run: () => undefined, ...overrides }
}

describe(start_crons_once, () => {
  test('a cron that ran recently before the boot is NOT run at boot — next run lands at last_run + interval', async () => {
    const now = Date.now()
    db.prepare('INSERT INTO cron_runs (name, last_run_at) VALUES (?, ?)').run('fresh', now - minutes(5))
    const run = vi.fn()
    start_crons_once({ defs: [def({ name: 'fresh', run })], db })

    // Even well past the quiet window, nothing fires before the wall-clock due time.
    await vi.advanceTimersByTimeAsync(QUIET_AFTER_BOOT_MS + minutes(5))
    expect(run).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(minutes(25)) // now at last_run + 30min + a bit
    expect(run).toHaveBeenCalledTimes(1)
  })

  test('first-ever + overdue crons run after the quiet window, spaced apart — never together', async () => {
    const first_run = vi.fn()
    const overdue_run = vi.fn()
    db.prepare('INSERT INTO cron_runs (name, last_run_at) VALUES (?, ?)').run('overdue', Date.now() - minutes(90))
    start_crons_once({ defs: [def({ name: 'first-ever', run: first_run }), def({ name: 'overdue', run: overdue_run })], db })

    await vi.advanceTimersByTimeAsync(QUIET_AFTER_BOOT_MS - 1000)
    expect(first_run).not.toHaveBeenCalled()
    expect(overdue_run).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2000) // past the quiet floor → first slot fires
    expect(first_run).toHaveBeenCalledTimes(1)
    expect(overdue_run).not.toHaveBeenCalled() // spaced into the next slot

    await vi.advanceTimersByTimeAsync(OVERDUE_SPACING_MS)
    expect(overdue_run).toHaveBeenCalledTimes(1)
  })

  test('a run persists last_run_at so the next boot sees it', async () => {
    start_crons_once({ defs: [def({ name: 'persisted' })], db })
    await vi.advanceTimersByTimeAsync(QUIET_AFTER_BOOT_MS + 1000)
    const row = db.prepare('SELECT last_run_at FROM cron_runs WHERE name = ?').get('persisted') as { last_run_at: number }
    // eslint-disable-next-line no-restricted-syntax -- genuine timestamp range check
    expect(row.last_run_at).toBeGreaterThanOrEqual(Date.now() - minutes(1))
  })

  test('short-interval crons take their natural first tick (no persistence, no quiet gate)', async () => {
    const run = vi.fn()
    start_crons_once({ defs: [def({ name: 'tick', every_ms: seconds(20), run })], db })
    await vi.advanceTimersByTimeAsync(seconds(20) + 100)
    expect(run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(seconds(20))
    expect(run).toHaveBeenCalledTimes(2)
    expect(db.prepare('SELECT COUNT(*) c FROM cron_runs').get()).toEqual({ c: 0 })
  })

  test('IS_STANDBY disables everything', () => {
    env_mock.IS_STANDBY = 'true'
    start_crons_once({ defs: [def({ name: 'anything' })], db })
    expect(get_cron_runtimes()).toHaveLength(0)
  })

  test('disabled_reason skips scheduling; on_start runs for scheduled crons only', () => {
    const on_start = vi.fn()
    start_crons_once({ defs: [
      def({ name: 'gated', disabled_reason: () => 'flag off', on_start }),
      def({ name: 'open', on_start }),
    ], db })
    expect(on_start).toHaveBeenCalledTimes(1)
    expect(get_cron_runtimes().map(runtime => runtime.name)).toEqual(['open'])
  })

  test('second start is a no-op (singleton)', async () => {
    const run = vi.fn()
    start_crons_once({ defs: [def({ name: 'once', every_ms: seconds(10), run })], db })
    start_crons_once({ defs: [def({ name: 'once', every_ms: seconds(10), run })], db })
    await vi.advanceTimersByTimeAsync(seconds(10) + 100)
    expect(run).toHaveBeenCalledTimes(1)
  })

  test('a throwing run does not kill the cadence', async () => {
    let calls = 0
    const run = () => {
      calls += 1
      throw new Error('boom')
    }
    start_crons_once({ defs: [def({ name: 'flaky', every_ms: seconds(10), run })], db })
    await vi.advanceTimersByTimeAsync(seconds(10) + 100)
    expect(calls).toBe(1)
    await vi.advanceTimersByTimeAsync(seconds(10))
    expect(calls).toBe(2)
  })
})

describe(next_daily_at, () => {
  const PT = 'America/Los_Angeles'

  test('finds the next 08:00 Pacific during PDT (UTC-7)', () => {
    // 2026-07-29 12:00 UTC = 05:00 PDT → 8am PT is 3h away, same day.
    const from = Date.parse('2026-07-29T12:00:00.000Z')
    expect(next_daily_at(from, { hour: 8, minute: 0, tz: PT })).toBe(from + 3 * 3600_000)
  })

  test('rolls to tomorrow once the hour has passed', () => {
    // 16:00 UTC = 09:00 PDT — 8am is behind us, so the answer is 23h out.
    const from = Date.parse('2026-07-29T16:00:00.000Z')
    expect(next_daily_at(from, { hour: 8, minute: 0, tz: PT })).toBe(from + 23 * 3600_000)
  })

  test('tracks the DST offset instead of a hardcoded UTC hour', () => {
    // The whole reason this is computed from the target zone's clock: 8am PT is
    // 15:00 UTC in summer and 16:00 UTC in winter. A fixed UTC hour would drift.
    const summer = Date.parse('2026-07-29T00:00:00.000Z')
    const winter = Date.parse('2026-12-29T00:00:00.000Z')
    const at = { hour: 8, minute: 0, tz: PT }
    expect(new Date(next_daily_at(summer, at)).toISOString()).toBe('2026-07-29T15:00:00.000Z')
    expect(new Date(next_daily_at(winter, at)).toISOString()).toBe('2026-12-29T16:00:00.000Z')
  })

  test('a clock-pinned cron is scheduled at its hour, never on the boot ladder', () => {
    const def: CronDef = {
      name: 'digest',
      description: 'daily digest',
      every_ms: 86_400_000,
      at: { hour: 8, minute: 0, tz: PT },
      run: () => Promise.resolve(),
    }
    start_crons_once({ defs: [def], db })
    const runtime = get_cron_runtimes().find(entry => entry.name === 'digest')
    // 12:00 UTC = 05:00 PDT, so it must be 3h out — not QUIET_AFTER_BOOT_MS.
    expect(runtime?.next_run_at).toBe(Date.now() + 3 * 3600_000)
    expect(runtime?.next_run_at).not.toBe(Date.now() + QUIET_AFTER_BOOT_MS)
  })
})
