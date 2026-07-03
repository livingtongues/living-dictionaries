import { vi } from 'vitest'
import type { EngineConnection } from './dict-sync-engine'
import { DictSyncEngine } from './dict-sync-engine'
import { _reset_dict_failure_throttle_for_tests } from './report-dict-sync-failure'
import { api_log } from '$api/log/_call'

vi.mock('$api/log/_call', () => ({
  api_log: vi.fn(() => Promise.resolve({ data: null, error: null })),
}))

function fake_connection({ dirty, deletes }: { dirty: () => number, deletes: () => number }): EngineConnection {
  return {
    query: <T>(sql: string) => {
      if (sql.includes('FROM deletes'))
        return Promise.resolve([{ c: deletes() }] as T[])
      if (sql.includes('dirty = 1'))
        return Promise.resolve([{ c: sql.includes('FROM "entries"') ? dirty() : 0 }] as T[])
      return Promise.resolve([] as T[])
    },
    execute: () => Promise.resolve(),
  }
}

function make_engine(connection: EngineConnection) {
  return new DictSyncEngine({
    dict_id: 'test-dict',
    connection,
    has_editor_role: true,
    get_auth: () => ({}) as never,
  })
}

describe('DictSyncEngine stuck-dirty watchdog', () => {
  beforeEach(() => {
    vi.mocked(api_log).mockClear()
    _reset_dict_failure_throttle_for_tests()
  })

  test('does not report on the first check with pending rows', async () => {
    const engine = make_engine(fake_connection({ dirty: () => 3, deletes: () => 0 }))
    await engine.check_stuck_dirty()
    expect(api_log).not.toHaveBeenCalled()
  })

  test('reports when pending rows survive two consecutive checks', async () => {
    const engine = make_engine(fake_connection({ dirty: () => 3, deletes: () => 1 }))
    await engine.check_stuck_dirty()
    await engine.check_stuck_dirty()
    expect(api_log).toHaveBeenCalledTimes(1)
    const [[payload]] = vi.mocked(api_log).mock.calls
    expect(payload.entries[0].message).toBe('dirty_rows_stuck')
    expect(payload.entries[0].context).toMatchObject({ dict_id: 'test-dict', dirty_rows: 3, deletes: 1 })
  })

  test('drained rows reset the consecutive-pending flag', async () => {
    let dirty = 2
    const engine = make_engine(fake_connection({ dirty: () => dirty, deletes: () => 0 }))
    await engine.check_stuck_dirty() // pending
    dirty = 0
    await engine.check_stuck_dirty() // drained → resets
    dirty = 2
    await engine.check_stuck_dirty() // pending again (first consecutive)
    expect(api_log).not.toHaveBeenCalled()
  })

  test('throttles repeat reports', async () => {
    const engine = make_engine(fake_connection({ dirty: () => 5, deletes: () => 0 }))
    await engine.check_stuck_dirty()
    await engine.check_stuck_dirty() // ships
    await engine.check_stuck_dirty() // throttled
    await engine.check_stuck_dirty() // throttled
    expect(api_log).toHaveBeenCalledTimes(1)
  })
})
