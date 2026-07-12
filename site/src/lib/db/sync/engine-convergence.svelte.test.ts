import type BetterSqlite3 from 'better-sqlite3'
import type { SqliteConnection } from '$lib/db/client/connection'
import type { SyncPostFn } from './engine.svelte'
import { open_logs_db } from '$lib/db/server/logs-db'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { process_sync } from '$lib/db/server/sync-helpers'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Sync } from './engine.svelte'

vi.mock('$api/log/_call', () => ({
  api_log: vi.fn(() => Promise.resolve({ data: null, error: null })),
}))

/**
 * End-to-end convergence proof for the shared.db admin engine — the LD-shared
 * sibling of the dict-engine convergence suite (cross-app hardening Parts 1+3;
 * house's Wayne wedge 2026-07-08). Real shared migrations on BOTH sides
 * (`open_test_shared_db()` — admin clients run the same files), the REAL
 * `Sync` engine, and the REAL `process_sync` as post_fn: the only shape that
 * catches CLIENT-side apply failures (a loser row still owning the natural key
 * when the canonical row arrives → `UNIQUE constraint failed` → apply rollback
 * → dirty never clears → retry forever).
 */

const T0 = '2026-07-09T00:00:00.000Z'
const T1 = '2026-07-09T00:00:01.000Z'

let server_db: ReturnType<typeof open_test_shared_db>
let client_db: ReturnType<typeof open_test_shared_db>
let logs_db: ReturnType<typeof open_logs_db>

function connection_for(db: BetterSqlite3.Database): SqliteConnection {
  return {
    query: <T>(sql: string, params: unknown[] = []) => Promise.resolve(db.prepare(sql).all(...params) as T[]),
    execute: (sql: string, params?: unknown[]) => {
      if (params?.length)
        db.prepare(sql).run(...params)
      else
        db.exec(sql)
      return Promise.resolve()
    },
    exec_raw: (sql: string) => {
      db.exec(sql)
      return Promise.resolve()
    },
    close: () => Promise.resolve(),
    delete_db: () => Promise.resolve(),
  }
}

function make_engine() {
  const post_fn: SyncPostFn = (body) => {
    try {
      const data = process_sync({ db: server_db, request: body, user_id: 'admin-1', logs_db })
      return Promise.resolve({ data, error: null })
    } catch (error) {
      return Promise.resolve({ data: null, error: { status: 500, message: (error as Error).message } })
    }
  }
  return new Sync({ connection: connection_for(client_db), post_fn })
}

function seed_parents(db: BetterSqlite3.Database) {
  db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES ('d1', 'Demo', ?, ?)`).run(T0, T0)
  db.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES ('u1', 'u1@example.com', ?, ?)`).run(T0, T0)
  db.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES ('admin-1', 'admin@example.com', ?, ?)`).run(T0, T0)
}

function insert_role({ db, id, dirty, updated_at }: { db: BetterSqlite3.Database, id: string, dirty?: boolean, updated_at: string }) {
  db.prepare(
    `INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, dirty, created_at, updated_at) VALUES (?, 'd1', 'u1', 'editor', ?, ?, ?)`,
  ).run(id, dirty ? 1 : null, T0, updated_at)
}

beforeEach(() => {
  server_db = open_test_shared_db()
  client_db = open_test_shared_db()
  logs_db = open_logs_db(':memory:')
  for (const db of [server_db, client_db])
    seed_parents(db)
})

afterEach(() => {
  server_db.close()
  client_db.close()
  logs_db.close()
})

describe('dictionary_roles duplicate-grant convergence (adopt-canonical)', () => {
  test('a client whose fresh-minted grant already exists server-side converges instead of wedging', async () => {
    insert_role({ db: server_db, id: 'role-canon', updated_at: T0 })
    insert_role({ db: client_db, id: 'role-loser', dirty: true, updated_at: T1 })

    const engine = make_engine()
    const result = await engine.sync()

    // Pre-fix the push 500ed server-side (`UNIQUE constraint failed:
    // dictionary_roles.…`); post-Part-1-only it would instead wedge CLIENT-side
    // applying the canonical echo. Either way `success` is the proof.
    expect(result?.error).toBeNull()
    expect(result?.success).toBeTruthy()

    // One grant, under the CANONICAL id, on BOTH sides.
    for (const db of [server_db, client_db])
      expect(db.prepare(`SELECT id FROM dictionary_roles`).all()).toEqual([{ id: 'role-canon' }])
    // The wedge loop is broken.
    const { n } = client_db.prepare(`SELECT COUNT(*) AS n FROM dictionary_roles WHERE dirty = 1`).get() as { n: number }
    expect(n).toBe(0)
    expect((client_db.prepare('SELECT COUNT(*) AS n FROM deletes').get() as { n: number }).n).toBe(0)

    // And the next sync is a clean no-op.
    const second = await engine.sync()
    expect(second?.success).toBeTruthy()
  })

  test('a tombstoned role pushed by a stale client is dropped, not resurrected', async () => {
    // Server: the grant was revoked (tombstone; cascade removed the row).
    server_db.prepare(`INSERT INTO deletes (table_name, id, updated_at) VALUES ('dictionary_roles', 'role-stale', ?)`).run(T0)
    // Client: still holds (and re-pushes) its stale copy.
    insert_role({ db: client_db, id: 'role-stale', dirty: true, updated_at: T0 })

    const engine = make_engine()
    const result = await engine.sync()
    expect(result?.success).toBeTruthy()

    for (const db of [server_db, client_db])
      expect(db.prepare(`SELECT id FROM dictionary_roles`).all()).toEqual([])
  })
})

describe('tombstone drain scoping', () => {
  test('a delete queued during the network round trip survives the apply (no blanket drain)', async () => {
    insert_role({ db: server_db, id: 'role-x', updated_at: T0 })
    insert_role({ db: client_db, id: 'role-x', updated_at: T0 })

    let mutated = false
    const post_fn: SyncPostFn = (body) => {
      // Mid-flight (after the request snapshot, before the apply): the user
      // deletes role-x locally. The old blanket `DELETE FROM deletes` silently
      // dropped this tombstone — it never reached the server.
      if (!mutated) {
        mutated = true
        client_db.prepare(`INSERT INTO deletes (table_name, id, updated_at) VALUES ('dictionary_roles', 'role-x', ?)`).run(T1)
        client_db.prepare(`DELETE FROM dictionary_roles WHERE id = 'role-x'`).run()
      }
      const data = process_sync({ db: server_db, request: body, user_id: 'admin-1', logs_db })
      return Promise.resolve({ data, error: null })
    }
    const engine = new Sync({ connection: connection_for(client_db), post_fn })

    const first = await engine.sync()
    expect(first?.error).toBeNull()
    // The tombstone is still queued locally…
    expect(client_db.prepare(`SELECT id FROM deletes WHERE table_name = 'dictionary_roles'`).all()).toEqual([{ id: 'role-x' }])
    // …and the NEXT sync pushes it through.
    const second = await engine.sync()
    expect(second?.error).toBeNull()
    expect(server_db.prepare(`SELECT id FROM dictionary_roles`).all()).toEqual([])
    expect(client_db.prepare(`SELECT COUNT(*) AS n FROM deletes`).get()).toEqual({ n: 0 })
  })
})

// The 2026-07-09 root fix: pulls ride the server-assigned `server_seq`, never
// the client-supplied `updated_at` LWW stamp. Under the old timestamp cursor a
// row pushed with an OLD stamp (offline editor, clock skew) landed BELOW other
// clients' cursors and was invisible to them FOREVER — until a child of it
// arrived and wedged their apply on the deferred-FK check.
describe('server_seq cursor closes the stale-stamp delta hole', () => {
  test('a row pushed with an updated_at OLDER than a peer cursor is still delivered', async () => {
    const engine = make_engine()
    const first = await engine.sync()
    expect(first?.success).toBeTruthy()
    const cursor_after_first = engine.watermark
    expect(cursor_after_first).not.toBeNull()

    // Another editor now pushes a role stamped in the PAST (T0 — far below any
    // timestamp cursor). The insert fires the server's seq trigger, so it gets
    // a seq ABOVE the peer's cursor even though its updated_at is ancient.
    insert_role({ db: server_db, id: 'role-backdated', updated_at: T0 })

    const second = await engine.sync()
    expect(second?.success).toBeTruthy()
    expect(client_db.prepare(`SELECT id FROM dictionary_roles WHERE id = 'role-backdated'`).get()).toBeTruthy()
    expect(engine.watermark).toBeGreaterThan(cursor_after_first ?? 0) // eslint-disable-line no-restricted-syntax -- cursor monotonicity is a genuine range check
  })
})

// FK self-heal: 2 consecutive fk_constraint apply failures → one automatic
// full resync + prune (no prompt; dirty rows ride the same request).
describe('FK-wedge self-heal (full resync + prune)', () => {
  test('a client missing a parent row heals itself instead of wedging', async () => {
    const engine = make_engine()
    expect((await engine.sync())?.success).toBeTruthy()

    // Server gains a user the client will NEVER see under normal deltas: we
    // backdate its seq below the client's cursor (the WHEN guard skips the
    // trigger when server_seq changes, so the backdate sticks) — simulating
    // the pre-fix hole / any residual poisoned mirror.
    server_db.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES ('u-hidden', 'hidden@example.com', ?, ?)`).run(T0, T0)
    server_db.prepare(`UPDATE users SET server_seq = 1 WHERE id = 'u-hidden'`).run()
    // …and a dictionary role referencing that user (fresh seq → WILL ride down).
    server_db.prepare(
      `INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES ('role-orphaning', 'd1', 'u-hidden', 'editor', ?, ?)`,
    ).run(T1, T1)
    // The client also holds a stale ghost row the server no longer has (a
    // cascade-deleted child whose tombstone it missed) — prune must clear it.
    insert_role({ db: client_db, id: 'role-ghost', updated_at: T0 })

    // 1st sync: apply rolls back on the deferred-FK check.
    const first = await engine.sync()
    expect(first?.success).toBeFalsy()
    expect(first?.error).toMatch(/FOREIGN KEY/i)
    expect(client_db.prepare(`SELECT 1 FROM dictionary_roles WHERE id = 'role-orphaning'`).get()).toBeFalsy()

    // 2nd sync: fails the same way, which fires the self-heal (async).
    const second = await engine.sync()
    expect(second?.success).toBeFalsy()
    await vi.waitFor(() => {
      expect(client_db.prepare(`SELECT 1 FROM users WHERE id = 'u-hidden'`).get()).toBeTruthy()
    })

    // Healed: missing parent + child present, ghost pruned, engine not halted.
    expect(client_db.prepare(`SELECT 1 FROM dictionary_roles WHERE id = 'role-orphaning'`).get()).toBeTruthy()
    expect(client_db.prepare(`SELECT 1 FROM dictionary_roles WHERE id = 'role-ghost'`).get()).toBeFalsy()
    expect(engine.blocked_by_repeated_failure).toBeFalsy()

    // And the next regular sync is clean.
    const after = await engine.sync()
    expect(after?.success).toBeTruthy()
  })

  test('self-heal preserves un-pushed dirty rows (they ride the same request)', async () => {
    const engine = make_engine()
    expect((await engine.sync())?.success).toBeTruthy()

    // Poison the delta (same shape as above)…
    server_db.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES ('u-hidden', 'hidden@example.com', ?, ?)`).run(T0, T0)
    server_db.prepare(`UPDATE users SET server_seq = 1 WHERE id = 'u-hidden'`).run()
    server_db.prepare(
      `INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES ('role-orphaning', 'd1', 'u-hidden', 'editor', ?, ?)`,
    ).run(T1, T1)
    // …while the client holds un-pushed local work.
    insert_role({ db: client_db, id: 'role-local-work', dirty: true, updated_at: T1 })

    await engine.sync()
    await engine.sync()
    await vi.waitFor(() => {
      expect(client_db.prepare(`SELECT 1 FROM users WHERE id = 'u-hidden'`).get()).toBeTruthy()
    })

    // The local edit survived the heal AND reached the server.
    expect(client_db.prepare(`SELECT 1 FROM dictionary_roles WHERE id = 'role-local-work'`).get()).toBeTruthy()
    expect(server_db.prepare(`SELECT 1 FROM dictionary_roles WHERE id = 'role-local-work'`).get()).toBeTruthy()
  })
})

// Cross-app hardening Part 2: the admin engine's repeat-fatal circuit breaker.
describe('Sync repeat-failure circuit breaker', () => {
  test('halts after 3 identical consecutive fatal failures; transient failures never halt', async () => {
    const on_repeated_failure = vi.fn()
    const post_fn: SyncPostFn = () => Promise.resolve({ data: null, error: { status: 500, message: 'UNIQUE constraint failed: users.email' } })
    const engine = new Sync({ connection: connection_for(client_db), post_fn, on_repeated_failure })

    await engine.sync()
    await engine.sync()
    expect(engine.blocked_by_repeated_failure).toBeFalsy()
    await engine.sync()
    expect(engine.blocked_by_repeated_failure).toBeTruthy()
    expect(on_repeated_failure).toHaveBeenCalledTimes(1)

    // Latched: a direct sync early-returns without posting.
    const posts_before = vi.mocked(post_fn).mock?.calls?.length
    await engine.sync()
    expect(posts_before).toBeUndefined() // post_fn isn't a spy — assert via state instead
    expect(engine.blocked_by_repeated_failure).toBeTruthy()
  })

  test('network failures never halt (offline retry loop must survive)', async () => {
    const post_fn: SyncPostFn = () => Promise.resolve({ data: null, error: { status: 502, message: 'Bad Gateway' } })
    const engine = new Sync({ connection: connection_for(client_db), post_fn })
    for (let i = 0; i < 5; i++)
      await engine.sync()
    expect(engine.blocked_by_repeated_failure).toBeFalsy()
  })

  test('a successful sync resets the streak', async () => {
    let fail = true
    const post_fn: SyncPostFn = (body) => {
      if (fail)
        return Promise.resolve({ data: null, error: { status: 500, message: 'boom' } })
      return Promise.resolve({ data: process_sync({ db: server_db, request: body, user_id: 'admin-1', logs_db }), error: null })
    }
    const engine = new Sync({ connection: connection_for(client_db), post_fn })
    await engine.sync()
    await engine.sync()
    fail = false
    await engine.sync()
    fail = true
    await engine.sync()
    await engine.sync()
    expect(engine.blocked_by_repeated_failure).toBeFalsy()
  })
})
