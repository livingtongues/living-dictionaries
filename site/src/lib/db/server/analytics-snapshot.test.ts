import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  _reset_analytics_snapshot_running_for_tests,
  analytics_snapshot_running,
  read_analytics_snapshot,
  run_analytics_snapshot_job,
  snapshot_dir,
  SNAPSHOT_FORMAT,
  snapshot_key,
  snapshot_targets,
  spawn_analytics_snapshot_job,
} from './analytics-snapshot'
import { open_logs_db } from './logs-db'
import { open_shared_db } from './shared-db'

/**
 * The job under test writes into `<DATA_DIR>/analytics/`, so every test runs
 * against a throwaway DATA_DIR containing real (tiny) shared.db + logs.db files —
 * the child opens its handles from paths, not from injected singletons, and that
 * path resolution is half of what can break.
 */
let data_dir: string
let previous_data_dir: string | undefined

function seed_databases({ with_logs = true }: { with_logs?: boolean } = {}) {
  // A real shared.db (migrations, db_metadata, rollup tables) at the path the job expects.
  const shared = open_shared_db(join(data_dir, 'shared.db'))
  shared.close()
  if (!with_logs)
    return
  const logs = open_logs_db(join(data_dir, 'logs.db'))
  logs.prepare(`
    INSERT INTO client_logs (id, received_at, level, message, source, session_id, user_id)
    VALUES ('l1', ?, 'info', 'session_start', 'client', 's1', 'u1')
  `).run(new Date().toISOString())
  logs.close()
}

beforeEach(() => {
  _reset_analytics_snapshot_running_for_tests()
  previous_data_dir = process.env.DATA_DIR
  data_dir = mkdtempSync(join(tmpdir(), 'analytics-snapshot-'))
  process.env.DATA_DIR = data_dir
})

afterEach(() => {
  if (previous_data_dir === undefined)
    delete process.env.DATA_DIR
  else
    process.env.DATA_DIR = previous_data_dir
  rmSync(data_dir, { recursive: true, force: true })
})

describe(snapshot_targets, () => {
  test('covers every window × audience the dashboards can request', () => {
    expect(snapshot_targets()).toEqual([
      { range: '30', audience: 'humans' },
      { range: '30', audience: 'bots' },
    ])
  })

  test('a key can never escape the snapshot directory', () => {
    expect(snapshot_key({ range: '30', audience: 'humans' })).toBe('30-humans')
    expect(snapshot_key({ range: '../../etc' as never, audience: 'humans' })).toBe('-etc-humans')
  })
})

describe(run_analytics_snapshot_job, () => {
  test('writes one checkpoint file per target, readable by the dashboards', async () => {
    seed_databases()

    const summary = await run_analytics_snapshot_job({ reason: 'test' })

    expect(summary.failed).toEqual([])
    expect(summary.written.map(entry => entry.key)).toEqual(['30-humans', '30-bots'])
    expect(readdirSync(snapshot_dir()).sort()).toEqual(['30-bots.json', '30-humans.json'])

    const snapshot = read_analytics_snapshot({ range: '30', audience: 'humans' })
    expect(snapshot?.format).toBe(SNAPSHOT_FORMAT)
    expect(snapshot?.reason).toBe('test')
    expect(snapshot?.payload.audience).toBe('humans')
    expect(snapshot?.payload.window_days).toBe(30)
    expect(snapshot?.payload.totals.sessions).toBe(1)
    // The host panel's logged half rides the payload (the request path adds `now`).
    expect(snapshot?.payload.host).not.toBe(null)
    // Cost is recorded so a slow checkpoint is visible without hand-measuring.
    // eslint-disable-next-line no-restricted-syntax -- a wall-clock duration
    expect(snapshot?.computed_ms).toBeGreaterThanOrEqual(0)
  })

  test('leaves no temp files behind and prunes payloads no target owns', async () => {
    seed_databases()
    mkdirSync(snapshot_dir(), { recursive: true })
    writeFileSync(join(snapshot_dir(), '90-humans.json'), '{"retired":true}')
    writeFileSync(join(snapshot_dir(), '30-humans.json.123.456.tmp'), 'half-written')
    // The legacy SWR memo directory the checkpoint replaces.
    mkdirSync(join(data_dir, 'analytics-cache'), { recursive: true })
    writeFileSync(join(data_dir, 'analytics-cache', 'full-52-humans.json'), '{}')

    const summary = await run_analytics_snapshot_job({ reason: 'test' })

    expect(summary.pruned.sort()).toEqual(['30-humans.json.123.456.tmp', '90-humans.json'])
    expect(readdirSync(snapshot_dir()).sort()).toEqual(['30-bots.json', '30-humans.json'])
    expect(existsSync(join(data_dir, 'analytics-cache'))).toBeFalsy()
  })

  test('a missing logs.db fails the whole job loudly (the parent logs it) and writes nothing', async () => {
    seed_databases({ with_logs: false })

    await expect(run_analytics_snapshot_job({ reason: 'test' })).rejects.toThrow()
    // …and nothing half-written is left readable.
    expect(read_analytics_snapshot({ range: '30', audience: 'humans' })).toBe(null)
  })
})

describe(read_analytics_snapshot, () => {
  test('reads a missing file as "no checkpoint"', () => {
    expect(read_analytics_snapshot({ range: '30', audience: 'humans' })).toBe(null)
  })

  test('reads a corrupt or truncated file as "no checkpoint" rather than throwing at an operator', () => {
    mkdirSync(snapshot_dir(), { recursive: true })
    writeFileSync(join(snapshot_dir(), '30-humans.json'), '{"format":1,"payload":{"tot')
    expect(read_analytics_snapshot({ range: '30', audience: 'humans' })).toBe(null)
  })

  test('reads an older payload FORMAT as "no checkpoint" so a stale shape never hydrates the UI', () => {
    mkdirSync(snapshot_dir(), { recursive: true })
    writeFileSync(join(snapshot_dir(), '30-humans.json'), JSON.stringify({ format: SNAPSHOT_FORMAT - 1, generated_at: 'x', payload: { totals: {} } }))
    expect(read_analytics_snapshot({ range: '30', audience: 'humans' })).toBe(null)
  })

  test('write is atomic — a reader never sees a partial payload', async () => {
    seed_databases()
    await run_analytics_snapshot_job({ reason: 'test' })
    const raw = readFileSync(join(snapshot_dir(), '30-humans.json'), 'utf8')
    // A rename can only publish a complete file; parse proves it.
    expect(() => JSON.parse(raw)).not.toThrow()
  })
})

describe(spawn_analytics_snapshot_job, () => {
  test('forks THIS module with the child flag, a heap cap and a nice-able IPC channel', async () => {
    const child = { pid: 4242, on: vi.fn(), kill: vi.fn() }
    const fork_impl = vi.fn(() => child) as never

    const outcome = await spawn_analytics_snapshot_job({ reason: 'cron', fork_impl, inline: false })

    expect(outcome).toBe('spawned')
    const { calls } = (fork_impl as unknown as { mock: { calls: [string, string[], Record<string, unknown>][] } }).mock
    const [[module_path, args, options]] = calls
    // The child re-enters through THIS file (bundled: the chunk that contains it).
    expect(module_path).toContain('analytics-snapshot')
    expect(args).toEqual([])
    expect((options.env as Record<string, string>).ANALYTICS_SNAPSHOT_CHILD).toBe('1')
    expect((options.env as Record<string, string>).ANALYTICS_SNAPSHOT_REASON).toBe('cron')
    expect(options.execArgv).toEqual(['--max-old-space-size=2048'])
    expect(options.stdio).toEqual(['ignore', 'inherit', 'inherit', 'ipc'])
    // A timeout kill, the summary and the exit handler are all wired.
    expect(child.on.mock.calls.map(([event]: [string]) => event).sort()).toEqual(['error', 'exit', 'message'])
  })

  test('refuses to run two children at once (one outage, one investigation)', async () => {
    const child = { pid: 1, on: vi.fn(), kill: vi.fn() }
    const fork_impl = vi.fn(() => child) as never

    expect(await spawn_analytics_snapshot_job({ reason: 'cron', fork_impl, inline: false })).toBe('spawned')
    expect(analytics_snapshot_running()).toBeTruthy()
    expect(await spawn_analytics_snapshot_job({ reason: 'manual', fork_impl, inline: false })).toBe('already-running')
    expect(fork_impl).toHaveBeenCalledOnce()

    // The `exit` handler is what clears the guard.
    const exit_handler = child.on.mock.calls.find(([event]: [string]) => event === 'exit')?.[1] as (code: number, signal: null) => void
    exit_handler(0, null)
    expect(analytics_snapshot_running()).toBeFalsy()
  })
})
