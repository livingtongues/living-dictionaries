import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { log_server_event } from '$lib/server/log-server-event'
import { _reset_media_sweep_running_for_tests, run_media_sweep } from './media-sweep-cron'
import { run_media_sweep_job } from './media-sweep-child'

vi.mock('$lib/server/log-server-event', () => ({ log_server_event: vi.fn() }))

/**
 * The property under test: the 381,719-object reconcile must not run on the
 * thread that answers requests (2026-08-06 log review §1.6 — a 20,233 ms freeze
 * and a user's 502 in the same second), and whatever it costs must be REPORTABLE
 * rather than inferred from a host sample.
 */

interface LoggedEvent { level: string, message: string, context?: Record<string, unknown> }
function logged(): LoggedEvent[] {
  return (log_server_event as unknown as { mock: { calls: [LoggedEvent][] } }).mock.calls.map(([call]) => call)
}

let data_dir: string
let previous_data_dir: string | undefined

beforeEach(() => {
  vi.clearAllMocks()
  _reset_media_sweep_running_for_tests()
  previous_data_dir = process.env.DATA_DIR
  data_dir = mkdtempSync(join(tmpdir(), 'media-sweep-parent-'))
  mkdirSync(join(data_dir, 'dictionaries'), { recursive: true })
  process.env.DATA_DIR = data_dir
})

afterEach(() => {
  _reset_media_sweep_running_for_tests()
  if (previous_data_dir === undefined)
    delete process.env.DATA_DIR
  else
    process.env.DATA_DIR = previous_data_dir
  rmSync(data_dir, { recursive: true, force: true })
})

function fake_child() {
  const handlers: Record<string, (...args: unknown[]) => void> = {}
  return {
    pid: 4242,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => { handlers[event] = handler }),
    kill: vi.fn(),
    emit: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
  }
}

describe(run_media_sweep, () => {
  test('forks a NICED child rather than listing R2 on the serving thread', async () => {
    const child = fake_child()
    const fork_impl = vi.fn(() => child) as never

    expect(await run_media_sweep({ fork_impl, inline: false })).toBe('spawned')

    const { calls } = (fork_impl as unknown as { mock: { calls: [string, string[], { env: Record<string, string> }][] } }).mock
    expect(calls).toHaveLength(1)
    // The forked path is the module's OWN bundle chunk, and the guard env var is
    // what makes re-entering it run the job instead of just defining it.
    expect(calls[0][0]).toContain('media-sweep-child')
    expect(calls[0][2].env.MEDIA_SWEEP_CHILD).toBe('1')
  })

  test('a second tick while the first child is alive does not fork again', async () => {
    const fork_impl = vi.fn(() => fake_child()) as never
    await run_media_sweep({ fork_impl, inline: false })
    expect(await run_media_sweep({ fork_impl, inline: false })).toBe('already-running')
    expect(fork_impl).toHaveBeenCalledTimes(1)
  })

  test('reports duration, step_ms and blocking_ms — the cost the old summary never carried', async () => {
    const child = fake_child()
    await run_media_sweep({ fork_impl: (() => child) as never, inline: false })

    child.emit('message', {
      type: 'summary',
      summary: {
        duration_ms: 20_233,
        reconciled: true,
        probe: { probed: 3, filled: 3, failures: 0 },
        reconcile: {
          listed: 381_719,
          adopted: 0,
          size_fixed: 0,
          ledger_rows_dropped: 2,
          newly_orphaned: 182,
          unorphaned: 0,
          dicts_unreadable: 0,
          dicts_braked: 0,
          deleted: 0,
          variants_healed: 0,
          variant_heal_failures: 0,
          video_thumbs_healed: 0,
          video_thumb_heal_failures: 0,
          duration_ms: 20_100,
          step_ms: { list: 18_000, ledger_diff: 1_900, heal: 200 },
          alerts: [],
        },
      },
    })
    child.emit('exit', 0, null)

    const reconciled = logged().find(event => event.message === 'media_sweep_reconciled')
    expect(reconciled.level).toBe('info')
    expect(reconciled.context).toMatchObject({ listed: 381_719, duration_ms: 20_100, step_ms: { list: 18_000, ledger_diff: 1_900, heal: 200 } })
    // The number this whole change is judged by: what the SERVING process paid.
    expect(typeof reconciled.context.blocking_ms).toBe('number')
    // eslint-disable-next-line no-restricted-syntax -- a real timing range: the parent's hold must stay under a request's worth of time
    expect(reconciled.context.blocking_ms).toBeLessThan(250)
    // …and the alert array itself never rides into the summary row.
    expect(reconciled.context.alerts).toBeUndefined()
    expect(logged().find(event => event.message === 'media_metadata_probed')).toBeTruthy()
  })

  test('per-dictionary alarms the child could not report itself are shipped by the parent', async () => {
    const child = fake_child()
    await run_media_sweep({ fork_impl: (() => child) as never, inline: false })

    child.emit('message', {
      type: 'summary',
      summary: {
        duration_ms: 10,
        reconciled: true,
        probe: null,
        reconcile: {
          listed: 1, adopted: 0, size_fixed: 0, ledger_rows_dropped: 0, newly_orphaned: 0, unorphaned: 0,
          dicts_unreadable: 1, dicts_braked: 1, deleted: 0, variants_healed: 0, variant_heal_failures: 0,
          video_thumbs_healed: 0, video_thumb_heal_failures: 0, duration_ms: 10,
          step_ms: { list: 1, ledger_diff: 1, heal: 1 },
          alerts: [
            { message: 'media_sweep_dict_unreadable', context: { dict_id: 'kumyk', objects: 40 } },
            { message: 'media_orphan_brake_tripped', context: { dict_id: 'gta', objects: 100, newly_orphaned: 100 } },
          ],
        },
      },
    })
    child.emit('exit', 0, null)

    const events = logged()
    expect(events.find(event => event.message === 'media_sweep_dict_unreadable')).toMatchObject({ level: 'error', context: { dict_id: 'kumyk' } })
    expect(events.find(event => event.message === 'media_orphan_brake_tripped')).toMatchObject({ level: 'error', context: { dict_id: 'gta' } })
    // A run that skipped a dictionary or braked is never filed as routine.
    expect(events.find(event => event.message === 'media_sweep_reconciled').level).toBe('warn')
  })

  test('a child that dies without a summary is a reported failure, not silence', async () => {
    const child = fake_child()
    await run_media_sweep({ fork_impl: (() => child) as never, inline: false })
    child.emit('exit', 1, null)

    expect(logged().find(event => event.message === 'media_sweep_failed')).toMatchObject({ level: 'error', context: { code: 1 } })
  })
})

describe(run_media_sweep_job, () => {
  test('a sweep that cannot even open shared.db reports the failure instead of throwing', async () => {
    // The parent must always get a summary it can log — a dead sweep must never
    // become an unhandled rejection inside the child.
    const summary = await run_media_sweep_job({ data_dir: join(data_dir, 'nowhere') })

    expect(summary.error).toBeTruthy()
    expect(summary.reconciled).toBeFalsy()
    expect(typeof summary.duration_ms).toBe('number')
  })
})
