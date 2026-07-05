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

describe('DictSyncEngine storage-lost recovery hook', () => {
  beforeEach(() => {
    vi.mocked(api_log).mockClear()
    _reset_dict_failure_throttle_for_tests()
  })

  function make_failing_engine({ error, on_storage_lost }: { error: Error, on_storage_lost: () => void }) {
    const connection: EngineConnection = {
      query: () => Promise.reject(error),
      execute: () => Promise.reject(error),
    }
    return new DictSyncEngine({
      dict_id: 'test-dict',
      connection,
      has_editor_role: true,
      get_auth: () => ({}) as never,
      on_storage_lost,
    })
  }

  test('fires on_storage_lost when a sync fails with a closed OPFS access handle', async () => {
    const on_storage_lost = vi.fn()
    const engine = make_failing_engine({ error: new Error('AccessHandle is closed'), on_storage_lost })
    await expect(engine.sync_once()).rejects.toThrow('AccessHandle is closed')
    expect(on_storage_lost).toHaveBeenCalledTimes(1)
  })

  test('does NOT fire on_storage_lost for ordinary failures', async () => {
    const on_storage_lost = vi.fn()
    const engine = make_failing_engine({ error: new Error('Failed to fetch'), on_storage_lost })
    await expect(engine.sync_once()).rejects.toThrow('Failed to fetch')
    expect(on_storage_lost).not.toHaveBeenCalled()
  })

  test('a closed-handle failure ships as a throttled warn (storage_lost), not an error', async () => {
    const engine = make_failing_engine({ error: new Error('AccessHandle is closed'), on_storage_lost: () => undefined })
    await expect(engine.sync_once()).rejects.toThrow()
    await expect(engine.sync_once()).rejects.toThrow() // repeat inside the throttle window
    expect(api_log).toHaveBeenCalledTimes(1)
    const [[payload]] = vi.mocked(api_log).mock.calls
    expect(payload.entries[0].level).toBe('warn')
    expect(payload.entries[0].context).toMatchObject({ kind: 'storage_lost', dict_id: 'test-dict' })
  })
})

describe('DictSyncEngine schema-outdated blocked state', () => {
  const original_fetch = globalThis.fetch

  beforeEach(() => {
    vi.mocked(api_log).mockClear()
    _reset_dict_failure_throttle_for_tests()
  })

  afterEach(() => {
    globalThis.fetch = original_fetch
  })

  /** Connection with no dirty rows / tombstones, so #build_request stays empty and the POST is reached. */
  const empty_connection: EngineConnection = {
    query: () => Promise.resolve([]),
    execute: () => Promise.resolve(),
  }

  function fake_response({ status, body }: { status: number, body: string }) {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(body),
      json: () => Promise.resolve(JSON.parse(body)),
    }
  }

  function make_blockable_engine(on_version_blocked: () => void) {
    return new DictSyncEngine({
      dict_id: 'test-dict',
      connection: empty_connection,
      has_editor_role: true,
      get_auth: () => ({}) as never,
      on_version_blocked,
    })
  }

  test('a schema_outdated (409) failure latches the block and fires on_version_blocked once', async () => {
    const fetch_spy = vi.fn(() => Promise.resolve(fake_response({ status: 409, body: JSON.stringify({ message: 'schema_outdated' }) })))
    globalThis.fetch = fetch_spy as never
    const on_version_blocked = vi.fn()
    const engine = make_blockable_engine(on_version_blocked)

    await expect(engine.sync_once()).rejects.toThrow()
    expect(on_version_blocked).toHaveBeenCalledTimes(1)
    expect(engine.is_version_blocked).toBeTruthy()
    expect(fetch_spy).toHaveBeenCalledTimes(1)

    // The 30s interval / post-write path must now no-op — no more server hits.
    await engine.sync_if_needed()
    await engine.sync_if_needed()
    expect(fetch_spy).toHaveBeenCalledTimes(1)
    expect(on_version_blocked).toHaveBeenCalledTimes(1)
  })

  test('a transient network failure does NOT block — the interval keeps retrying', async () => {
    const fetch_spy = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    globalThis.fetch = fetch_spy as never
    const on_version_blocked = vi.fn()
    const engine = make_blockable_engine(on_version_blocked)

    await expect(engine.sync_once()).rejects.toThrow()
    expect(on_version_blocked).not.toHaveBeenCalled()
    expect(engine.is_version_blocked).toBeFalsy()

    await engine.sync_if_needed() // retries (not blocked)
    expect(fetch_spy).toHaveBeenCalledTimes(2)
  })

  test('server_outdated (503) does NOT block — it is transient and self-heals', async () => {
    const fetch_spy = vi.fn(() => Promise.resolve(fake_response({ status: 503, body: JSON.stringify({ message: 'server_outdated' }) })))
    globalThis.fetch = fetch_spy as never
    const on_version_blocked = vi.fn()
    const engine = make_blockable_engine(on_version_blocked)

    await expect(engine.sync_once()).rejects.toThrow()
    expect(on_version_blocked).not.toHaveBeenCalled()
    expect(engine.is_version_blocked).toBeFalsy()

    await engine.sync_if_needed() // keeps retrying while the server catches up
    expect(fetch_spy).toHaveBeenCalledTimes(2)
  })
})
