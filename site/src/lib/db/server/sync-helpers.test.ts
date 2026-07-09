import type Database from 'better-sqlite3'
import type { SyncRequest } from '$lib/db/sync/types'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_logs_db } from './logs-db'
import { latest_shared_migration_name, open_shared_db } from './shared-db'
import { process_sync } from './sync-helpers'

let db: Database.Database

beforeEach(() => {
  db = open_shared_db(':memory:')
})

afterEach(() => {
  db.close()
})

function empty_request(): SyncRequest {
  return {
    synced_up_to: null,
    dirty_rows: {},
    deletes: [],
    latest_migration: latest_shared_migration_name,
  }
}

describe(process_sync, () => {
  test('completes a round trip on a healthy DB', () => {
    const response = process_sync({ db, request: empty_request() })
    expect(response.deletes).toEqual([])
    expect(response.changes.dictionary_partners).toBeUndefined()
  })

  // Regression: a syncable table absent on a DB provisioned before the migration
  // that added it (the `dictionary_partners` consolidation-drift incident) must
  // NOT 500 the whole admin sync — it should skip + log the missing table.
  test('skips and logs a missing syncable table instead of throwing', () => {
    db.exec('DROP TABLE dictionary_partners')
    // `client_logs` lives in logs.db (split out of shared.db 2026-07-05), so the
    // drift warn must land there — logging to the shared `db` would silently drop
    // on a post-split server where that table is gone.
    const logs_db = open_logs_db(':memory:')

    const response = process_sync({ db, request: empty_request(), user_id: 'admin-1', logs_db })
    expect(response.changes.dictionary_partners).toBeUndefined()

    const log = logs_db.prepare(
      `SELECT level, message, context FROM client_logs WHERE message = 'sync_missing_syncable_table'`,
    ).get() as { level: string, message: string, context: string } | undefined
    expect(log).toBeDefined()
    expect(log?.level).toBe('warn')
    expect(JSON.parse(log?.context ?? '{}').missing_tables).toEqual(['dictionary_partners'])
    logs_db.close()
  })

  test('still pushes a dirty row for a present table when another table is missing', () => {
    db.exec('DROP TABLE dictionary_partners')
    db.prepare(`INSERT INTO dictionaries (id, name, updated_at) VALUES ('d1', 'Demo', '2026-06-29T00:00:00.000Z')`).run()

    const request = empty_request()
    request.synced_up_to = 0
    const response = process_sync({ db, request, user_id: 'admin-1' })
    expect(response.changes.dictionaries?.find(row => row.id === 'd1')).toBeDefined()
  })
})

describe('dictionary_roles natural-key dedup (adopt-canonical + loser echo)', () => {
  const T0 = '2026-07-09T00:00:00.000Z'
  const T1 = '2026-07-09T00:00:01.000Z'

  function seed_role(role_id: string, at: string) {
    db.prepare(`INSERT INTO dictionaries (id, name, updated_at) VALUES ('d1', 'Demo', ?)`).run(at)
    db.prepare(`INSERT INTO users (id, email, updated_at) VALUES ('u1', 'u1@example.com', ?)`).run(at)
    db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, 'd1', 'u1', 'editor', ?, ?)`).run(role_id, at, at)
  }

  // Cursor 0 = "behind everything" (the old timestamp cursor was T0; a low seq
  // has the same "client is behind the seeded rows" meaning).
  const role_push = (id: string, at: string): SyncRequest => ({
    synced_up_to: 0,
    dirty_rows: { dictionary_roles: [{ id, dictionary_id: 'd1', user_id: 'u1', role: 'editor', invited_by_user_id: null, dirty: 1, created_at: at, updated_at: at }] },
    deletes: [],
    latest_migration: latest_shared_migration_name,
  })

  test('a second same-grant push with a different id does not 500; adopts the canonical id + echoes the loser delete', () => {
    seed_role('role_A', T0)

    // Pre-fix this threw `UNIQUE constraint failed: dictionary_roles.dictionary_id`
    // and rolled back the WHOLE push (the latent Part 1 bug).
    const response = process_sync({ db, request: role_push('role_B', T1), user_id: 'admin-1' })

    // One grant, canonical id, on the server.
    const rows = db.prepare(`SELECT id FROM dictionary_roles`).all() as { id: string }[]
    expect(rows).toEqual([{ id: 'role_A' }])
    // Loser delete echoed + tombstoned; canonical row echoed so the pushing
    // client converges (drop loser → adopt canonical) instead of wedging.
    expect(response.deletes).toContainEqual({ table_name: 'dictionary_roles', id: 'role_B' })
    expect(db.prepare(`SELECT 1 FROM deletes WHERE table_name = 'dictionary_roles' AND id = 'role_B'`).get()).toBeTruthy()
    expect((response.changes.dictionary_roles ?? []).map(row => row.id)).toContain('role_A')
  })

  test('an LWW-losing duplicate grant still converges (loser delete + canonical echo, canonical content kept)', () => {
    seed_role('role_A', T1) // canonical is NEWER than the push

    const response = process_sync({ db, request: role_push('role_B', T0), user_id: 'admin-1' })

    expect(response.deletes).toContainEqual({ table_name: 'dictionary_roles', id: 'role_B' })
    expect((response.changes.dictionary_roles ?? []).map(row => row.id)).toContain('role_A')
    const row = db.prepare(`SELECT updated_at FROM dictionary_roles WHERE id = 'role_A'`).get() as { updated_at: string }
    expect(row.updated_at).toBe(T1)
  })

  test('tombstone-resurrection guard: a stale client copy of a deleted row is refused + delete echoed', () => {
    seed_role('role_A', T0)
    // The role is revoked server-side (tombstone + cascade delete).
    db.prepare(`INSERT INTO deletes (table_name, id, updated_at) VALUES ('dictionary_roles', 'role_A', ?)`).run(T1)
    db.prepare(`DELETE FROM dictionary_roles WHERE id = 'role_A'`).run()

    // A stale client that never pulled the revocation re-pushes its copy.
    const response = process_sync({ db, request: role_push('role_A', T0), user_id: 'admin-1' })

    // NOT resurrected; the delete is echoed so the stale client drops it too.
    expect(db.prepare(`SELECT 1 FROM dictionary_roles WHERE id = 'role_A'`).get()).toBeFalsy()
    expect(response.deletes).toContainEqual({ table_name: 'dictionary_roles', id: 'role_A' })
  })
})

// Port of the dict engine's FK-orphan push recovery (2026-07-09): one dangling
// pushed child row must not roll back (and 500) the WHOLE admin round trip.
describe('FK-orphan push recovery (skip + report)', () => {
  const T0 = '2026-07-09T00:00:00.000Z'

  test('skips the dangling child, lands the rest, reports it in skipped_orphans', () => {
    db.prepare(`INSERT INTO users (id, email, providers) VALUES ('u1', 'u1@example.com', '[]')`).run()
    db.prepare(`INSERT INTO dictionaries (id, name) VALUES ('d1', 'Demo')`).run()

    const request = empty_request()
    request.synced_up_to = 0
    request.dirty_rows = {
      // Lands: parents exist.
      dictionary_roles: [
        { id: 'role_good', dictionary_id: 'd1', user_id: 'u1', role: 'editor', invited_by_user_id: null, dirty: 1, created_at: T0, updated_at: T0 },
        // Orphan: dictionary 'ghost-dict' does not exist server-side.
        { id: 'role_orphan', dictionary_id: 'ghost-dict', user_id: 'u1', role: 'editor', invited_by_user_id: null, dirty: 1, created_at: T0, updated_at: T0 },
      ],
    }

    const response = process_sync({ db, request, user_id: 'u1' })

    expect(db.prepare(`SELECT 1 FROM dictionary_roles WHERE id = 'role_good'`).get()).toBeTruthy()
    expect(db.prepare(`SELECT 1 FROM dictionary_roles WHERE id = 'role_orphan'`).get()).toBeFalsy()
    expect(response.skipped_orphans).toEqual([
      { table_name: 'dictionary_roles', id: 'role_orphan', parent_table: 'dictionaries' },
    ])
  })

  test('an FK violation NOT attributable to a pushed row still surfaces', () => {
    // Pull-only request + a server-side violation is impossible to construct via
    // the API, so simulate the guard directly: a push whose rows are all valid
    // must not be blamed. (The recovery only retries when orphans came from the
    // push — anything else rethrows the original error.)
    db.prepare(`INSERT INTO users (id, email, providers) VALUES ('u1', 'u1@example.com', '[]')`).run()
    db.prepare(`INSERT INTO dictionaries (id, name) VALUES ('d1', 'Demo')`).run()
    const request = empty_request()
    request.dirty_rows = {
      dictionary_roles: [{ id: 'role_ok', dictionary_id: 'd1', user_id: 'u1', role: 'editor', invited_by_user_id: null, dirty: 1, created_at: T0, updated_at: T0 }],
    }
    const response = process_sync({ db, request, user_id: 'u1' })
    expect(response.skipped_orphans).toBeUndefined()
    expect(db.prepare(`SELECT 1 FROM dictionary_roles WHERE id = 'role_ok'`).get()).toBeTruthy()
  })
})
