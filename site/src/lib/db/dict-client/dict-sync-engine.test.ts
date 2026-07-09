import BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DICT_SYNCABLE_TABLES } from '$lib/db/dict-syncable-tables'
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

/**
 * Live repro (real better-sqlite3, so the constraint actually fires) of the
 * junction natural-key UNIQUE collision — the PA2 parity audit of house's
 * 2026-07-05 fix. Every dict junction carries a synthetic-UUID PK + natural-key
 * UNIQUE the upsert's `ON CONFLICT(id)` doesn't cover, and a link is replace-all
 * (unlink then re-link the same natural key → old id tombstoned + a BRAND-NEW id
 * inserted). A `/changes` window carrying BOTH the delete for the old id and the
 * upsert for the new row must apply the delete FIRST, else the re-insert of the
 * natural key collides with the still-present old row and wedges the dict sync.
 */
describe('DictSyncEngine junction natural-key replace-all apply ordering', () => {
  let db: BetterSqlite3.Database

  beforeEach(() => {
    vi.mocked(api_log).mockClear()
    _reset_dict_failure_throttle_for_tests()
    db = new BetterSqlite3(':memory:')
    db.exec('CREATE TABLE db_metadata (key TEXT PRIMARY KEY, value TEXT);')
    db.exec('CREATE TABLE deletes (table_name TEXT NOT NULL, id TEXT NOT NULL);')
    for (const table of DICT_SYNCABLE_TABLES) {
      if (table === 'entry_tags')
        db.exec(`CREATE TABLE entry_tags (id TEXT PRIMARY KEY, entry_id TEXT NOT NULL, tag_id TEXT NOT NULL, dirty INTEGER, UNIQUE (entry_id, tag_id));`)
      else
        db.exec(`CREATE TABLE "${table}" (id TEXT PRIMARY KEY, dirty INTEGER);`)
    }
  })

  afterEach(() => {
    db.close()
  })

  function real_connection(): EngineConnection {
    return {
      query: <T>(sql: string, params: unknown[] = []) => Promise.resolve(db.prepare(sql).all(...(params as never[])) as T[]),
      execute: (sql: string, params?: unknown[]) => {
        if (params?.length)
          db.prepare(sql).run(...(params as never[]))
        else
          db.exec(sql)
        return Promise.resolve()
      },
    }
  }

  test('applies a delete + same-natural-key re-insert without a UNIQUE collision', async () => {
    // An old junction row already lives locally under an old id (clean, not dirty).
    db.prepare(`INSERT INTO entry_tags (id, entry_id, tag_id, dirty) VALUES ('old-id', 'e1', 't1', NULL)`).run()

    // The server response for a replace-all re-link: delete the OLD id AND upsert
    // a BRAND-NEW row for the SAME natural key (e1/t1) in one window.
    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        new_synced_up_to: '2026-07-06T00:00:00.000Z',
        changes: { entry_tags: [{ id: 'new-id', entry_id: 'e1', tag_id: 't1' }] },
        deletes: [{ table_name: 'entry_tags', id: 'old-id' }],
      }),
    })) as never

    const engine = new DictSyncEngine({ dict_id: 'test-dict', connection: real_connection(), has_editor_role: true, get_auth: () => ({}) as never })
    await expect(engine.sync_once()).resolves.not.toThrow()

    // Exactly one row for the natural key, now under the NEW id — deletes-first
    // freed the natural key before the re-insert.
    const rows = db.prepare(`SELECT id FROM entry_tags WHERE entry_id = 'e1' AND tag_id = 't1'`).all() as { id: string }[]
    expect(rows).toEqual([{ id: 'new-id' }])
  })
})

// Cross-app hardening Part 2 (mirrored from house): a repeated same-signature
// fatal failure must trip the circuit breaker — halt the 30s retry loop + fire
// the prompt hook once — while transient failures keep retrying forever.
describe('DictSyncEngine repeat-failure circuit breaker', () => {
  beforeEach(() => {
    vi.mocked(api_log).mockClear()
    _reset_dict_failure_throttle_for_tests()
  })

  function make_breaker_engine({ error, on_repeated_failure, on_integrity_wedged }: { error: Error, on_repeated_failure?: (info: { message: string, consecutive: number }) => void, on_integrity_wedged?: () => void }) {
    const query = vi.fn(() => Promise.reject(error))
    const connection: EngineConnection = { query, execute: () => Promise.reject(error) }
    const engine = new DictSyncEngine({
      dict_id: 'test-dict',
      connection,
      has_editor_role: true,
      get_auth: () => ({}) as never,
      on_repeated_failure,
      on_integrity_wedged,
    })
    return { engine, query }
  }

  test('halts after 3 identical consecutive fatal failures and fires on_repeated_failure once', async () => {
    const on_repeated_failure = vi.fn()
    const { engine } = make_breaker_engine({ error: new Error('FOREIGN KEY constraint failed'), on_repeated_failure })
    await expect(engine.sync_once()).rejects.toThrow()
    await expect(engine.sync_once()).rejects.toThrow()
    expect(engine.is_repeated_failure_blocked).toBeFalsy()
    await expect(engine.sync_once()).rejects.toThrow()
    expect(engine.is_repeated_failure_blocked).toBeTruthy()
    expect(on_repeated_failure).toHaveBeenCalledTimes(1)
    expect(on_repeated_failure).toHaveBeenCalledWith({ message: 'FOREIGN KEY constraint failed', consecutive: 3 })
  })

  test('once latched, sync_once early-returns null and sync_if_needed no-ops (no more pushes)', async () => {
    const { engine, query } = make_breaker_engine({ error: new Error('FOREIGN KEY constraint failed') })
    for (let i = 0; i < 3; i++)
      await expect(engine.sync_once()).rejects.toThrow()
    const calls_at_latch = query.mock.calls.length
    await expect(engine.sync_once()).resolves.toBeNull()
    await engine.sync_if_needed()
    expect(query.mock.calls).toHaveLength(calls_at_latch)
  })

  test('transient failures (storage_lost) never halt, no matter how many', async () => {
    const { engine } = make_breaker_engine({ error: new Error('AccessHandle is closed') })
    for (let i = 0; i < 5; i++)
      await expect(engine.sync_once()).rejects.toThrow()
    expect(engine.is_repeated_failure_blocked).toBeFalsy()
  })

  test('fires on_integrity_wedged ONCE at the 2nd consecutive fk_constraint failure (before the breaker halts at 3)', async () => {
    const on_integrity_wedged = vi.fn()
    const { engine } = make_breaker_engine({ error: new Error('FOREIGN KEY constraint failed'), on_integrity_wedged })
    await expect(engine.sync_once()).rejects.toThrow()
    expect(on_integrity_wedged).not.toHaveBeenCalled()
    await expect(engine.sync_once()).rejects.toThrow()
    expect(on_integrity_wedged).toHaveBeenCalledTimes(1)
    expect(engine.is_repeated_failure_blocked).toBeFalsy() // heal fires BEFORE the halt
    // A 3rd failure (heal didn't rescue in time) doesn't re-fire the hook.
    await expect(engine.sync_once()).rejects.toThrow()
    expect(on_integrity_wedged).toHaveBeenCalledTimes(1)
  })

  test('a non-FK fatal failure never fires on_integrity_wedged', async () => {
    const on_integrity_wedged = vi.fn()
    const { engine } = make_breaker_engine({ error: new Error('UNIQUE constraint failed: entry_tags.entry_id'), on_integrity_wedged })
    for (let i = 0; i < 3; i++)
      await expect(engine.sync_once()).rejects.toThrow()
    expect(on_integrity_wedged).not.toHaveBeenCalled()
  })
})
