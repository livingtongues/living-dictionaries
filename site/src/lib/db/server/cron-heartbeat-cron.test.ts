import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { CronDef } from './cron-scheduler'
import { log_server_event } from '$lib/server/log-server-event'
import { build_cron_heartbeats, run_cron_heartbeat_sweep, STALE_CADENCE_MULTIPLE } from './cron-heartbeat-cron'
import { CRONS, hours, minutes } from './crons'

vi.mock('$lib/server/log-server-event', () => ({ log_server_event: vi.fn() }))

beforeEach(() => {
  vi.mocked(log_server_event).mockClear()
})

const NOW = Date.parse('2026-08-02T10:00:00.000Z')

function def(overrides: Partial<CronDef> & { name: string }): CronDef {
  return { description: 'test cron', every_ms: minutes(15), run: () => undefined, ...overrides }
}

function runtime(overrides: { name: string, every_ms?: number, last_run_at?: number | null, next_run_at?: number | null, in_flight?: boolean }) {
  return {
    every_ms: minutes(15),
    last_run_at: NOW - minutes(5),
    next_run_at: NOW + minutes(10),
    in_flight: false,
    ...overrides,
  }
}

describe(build_cron_heartbeats, () => {
  test('a cron ticking on cadence is one info row that says when it last ran', () => {
    const [row] = build_cron_heartbeats({
      roster: [def({ name: 'wal-checkpoint' })],
      runtimes: [runtime({ name: 'wal-checkpoint' })],
      now: NOW,
      uptime_ms: hours(9),
    })

    expect(row.level).toBe('info')
    expect(row.context.cron).toBe('wal-checkpoint')
    expect(row.context.ran).toBeTruthy()
    expect(row.context.stale).toBeFalsy()
    expect(row.context.since_last_run_ms).toBe(minutes(5))
    expect(row.context.last_run_at).toBe('2026-08-02T09:55:00.000Z')
  })

  test('silence past twice the cadence is the alarm — this is the dead-cron case', () => {
    const [row] = build_cron_heartbeats({
      roster: [def({ name: 'wal-checkpoint' })],
      runtimes: [runtime({ name: 'wal-checkpoint', last_run_at: NOW - minutes(15) * STALE_CADENCE_MULTIPLE - 1000 })],
      now: NOW,
      uptime_ms: hours(9),
    })

    expect(row.level).toBe('warn')
    expect(row.context.stale).toBeTruthy()
    expect(row.context.ran).toBeTruthy()
  })

  test('one missed tick is NOT an alarm — overdue spacing and a slow run are normal', () => {
    const [row] = build_cron_heartbeats({
      roster: [def({ name: 'wal-checkpoint' })],
      runtimes: [runtime({ name: 'wal-checkpoint', last_run_at: NOW - minutes(20) })],
      now: NOW,
      uptime_ms: hours(9),
    })

    expect(row.level).toBe('info')
    expect(row.context.stale).toBeFalsy()
  })

  test('a daily cron on a freshly booted container is not dead, it is young', () => {
    const [row] = build_cron_heartbeats({
      roster: [def({ name: 'log-retention', every_ms: hours(24) })],
      runtimes: [runtime({ name: 'log-retention', every_ms: hours(24), last_run_at: null })],
      now: NOW,
      uptime_ms: minutes(4),
    })

    expect(row.level).toBe('info')
    expect(row.context.ran).toBeFalsy()
    expect(row.context.since_last_run_ms).toBe(null)
  })

  test('a cron that has never run on a long-lived container IS the alarm', () => {
    const [row] = build_cron_heartbeats({
      roster: [def({ name: 'log-retention', every_ms: hours(24) })],
      runtimes: [runtime({ name: 'log-retention', every_ms: hours(24), last_run_at: null })],
      now: NOW,
      uptime_ms: hours(72),
    })

    expect(row.level).toBe('warn')
    expect(row.context.stale).toBeTruthy()
    expect(row.context.ran).toBeFalsy()
  })

  test('a rostered cron the scheduler never took reports the reason instead of vanishing', () => {
    const [row] = build_cron_heartbeats({
      roster: [def({ name: 'snapshot', disabled_reason: () => 'R2 credentials missing' })],
      runtimes: [],
      now: NOW,
      uptime_ms: hours(9),
    })

    // info, not warn: a declared configuration state, with the reason attached.
    expect(row.level).toBe('info')
    expect(row.context.scheduled).toBeFalsy()
    expect(row.context.ran).toBeFalsy()
    expect(row.context.disabled_reason).toBe('R2 credentials missing')
  })

  test('every cron on the roster gets exactly one row, in roster order', () => {
    const rows = build_cron_heartbeats({
      roster: [def({ name: 'a' }), def({ name: 'b' }), def({ name: 'c' })],
      runtimes: [runtime({ name: 'b' })],
      now: NOW,
      uptime_ms: hours(9),
    })

    expect(rows.map(row => row.context.cron)).toEqual(['a', 'b', 'c'])
    expect(rows.map(row => row.context.scheduled)).toEqual([false, true, false])
  })
})

describe(run_cron_heartbeat_sweep, () => {
  test('the real roster produces exactly one row per cron, and the heartbeat is itself on it', () => {
    run_cron_heartbeat_sweep()

    const rows = vi.mocked(log_server_event).mock.calls.map(([call]) => call)
    expect(rows).toHaveLength(CRONS.length)
    expect(rows.every(row => row.message === 'cron_heartbeat')).toBeTruthy()
    // Reporting on itself is the point: a heartbeat that stops arriving only
    // reads as "dead" if it was arriving in the first place.
    expect(rows.map(row => row.context?.cron)).toContain('cron-heartbeat')
  })
})
