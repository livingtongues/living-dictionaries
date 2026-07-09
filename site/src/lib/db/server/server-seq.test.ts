import type { SyncRequest } from '$lib/db/sync/types'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { read_server_seq_counter } from './dictionary-sync-helpers'
import { latest_shared_migration_name, open_shared_db } from './shared-db'
import { process_sync } from './sync-helpers'

/**
 * The 20260709 server_seq migration's load-bearing behaviors, proven against
 * the REAL migration files (shared.db + dict.db). These are the invariants the
 * whole FK-wedge root fix rests on — see
 * .issues/sync-fk-wedge-server-seq-and-self-heal.md.
 */

describe('server_seq triggers (shared.db)', () => {
  test('every insert/update assigns a fresh, strictly increasing seq', () => {
    const db = open_shared_db(':memory:')
    const seq_of = (id: string) => (db.prepare(`SELECT server_seq FROM users WHERE id = ?`).get(id) as { server_seq: number }).server_seq

    const start = read_server_seq_counter(db)
    db.prepare(`INSERT INTO users (id, email, providers) VALUES ('u1', 'a@x.com', '[]')`).run()
    db.prepare(`INSERT INTO users (id, email, providers) VALUES ('u2', 'b@x.com', '[]')`).run()
    const u1_first = seq_of('u1')
    expect(u1_first).toBe(start + 1)
    expect(seq_of('u2')).toBe(start + 2)

    db.prepare(`UPDATE users SET name = 'renamed' WHERE id = 'u1'`).run()
    expect(seq_of('u1')).toBe(start + 3)
    expect(read_server_seq_counter(db)).toBe(start + 3)
    db.close()
  })

  test('FK actions (ON DELETE SET NULL) fire the seq trigger — cascade-touched rows ride the next pull', () => {
    const db = open_shared_db(':memory:')
    db.prepare(`INSERT INTO users (id, email, providers) VALUES ('author', 'a@x.com', '[]')`).run()
    db.prepare(`INSERT INTO dictionaries (id, name, created_by_user_id) VALUES ('d1', 'Demo', 'author')`).run()
    const cursor = read_server_seq_counter(db)

    // Tombstone-driven delete of the user: the cascade SET NULLs
    // dictionaries.created_by_user_id, which MUST assign a fresh seq — a peer
    // pulling `server_seq > cursor` has to receive the nulled dictionary row,
    // or its local FK check wedges (the original bug class).
    db.prepare(`INSERT INTO deletes (table_name, id) VALUES ('users', 'author')`).run()

    const dict = db.prepare(`SELECT created_by_user_id, server_seq FROM dictionaries WHERE id = 'd1'`).get() as { created_by_user_id: string | null, server_seq: number }
    expect(dict.created_by_user_id).toBeNull()
    expect(dict.server_seq).toBe(cursor + 2) // +1 tombstone, +2 the SET NULL update
    db.close()
  })

  test('tombstone inserts get a seq (the deletes pull rides the same cursor)', () => {
    const db = open_shared_db(':memory:')
    const cursor = read_server_seq_counter(db)
    db.prepare(`INSERT INTO deletes (table_name, id) VALUES ('dictionary_roles', 'gone')`).run()
    const tombstone = db.prepare(`SELECT server_seq FROM deletes WHERE id = 'gone'`).get() as { server_seq: number }
    expect(tombstone.server_seq).toBe(cursor + 1)
    db.close()
  })

  test('a pushed server_seq is stripped — the server always reassigns', () => {
    const db = open_shared_db(':memory:')
    db.prepare(`INSERT INTO dictionaries (id, name) VALUES ('d1', 'Demo')`).run()
    db.prepare(`INSERT INTO users (id, email, providers) VALUES ('u1', 'a@x.com', '[]')`).run()
    const cursor = read_server_seq_counter(db)

    const request: SyncRequest = {
      synced_up_to: cursor,
      // A (stale/hostile) client claims server_seq 1 — accepting it would hide
      // the row below every other client's cursor forever.
      dirty_rows: { dictionary_roles: [{ id: 'r1', dictionary_id: 'd1', user_id: 'u1', role: 'editor', invited_by_user_id: null, dirty: 1, server_seq: 1, created_at: '2026-07-09T00:00:00.000Z', updated_at: '2026-07-09T00:00:00.000Z' }] },
      deletes: [],
      latest_migration: latest_shared_migration_name,
    }
    process_sync({ db, request, user_id: 'u1' })

    const row = db.prepare(`SELECT server_seq FROM dictionary_roles WHERE id = 'r1'`).get() as { server_seq: number }
    expect(row.server_seq).toBe(cursor + 1)
    db.close()
  })
})

describe('server_seq triggers (dict.db)', () => {
  test('content writes assign fresh seqs; the counter is the pull high-water mark', () => {
    const db = open_dictionary_db_in_memory('seq_test')
    const start = read_server_seq_counter(db)

    db.prepare(`INSERT INTO entries (id, lexeme, created_by_user_id, updated_by_user_id) VALUES ('e1', '{}', 'u1', 'u1')`).run()
    db.prepare(`INSERT INTO senses (id, entry_id, created_by_user_id, updated_by_user_id) VALUES ('s1', 'e1', 'u1', 'u1')`).run()
    db.prepare(`UPDATE entries SET phonetic = 'x' WHERE id = 'e1'`).run()

    const entry = db.prepare(`SELECT server_seq FROM entries WHERE id = 'e1'`).get() as { server_seq: number }
    const sense = db.prepare(`SELECT server_seq FROM senses WHERE id = 's1'`).get() as { server_seq: number }
    expect(sense.server_seq).toBe(start + 2)
    expect(entry.server_seq).toBe(start + 3) // the UPDATE re-stamped it
    expect(read_server_seq_counter(db)).toBe(start + 3)
    db.close()
  })

  test('tombstone-driven cascade delete: children vanish, parent tombstone carries the seq', () => {
    const db = open_dictionary_db_in_memory('seq_test')
    db.prepare(`INSERT INTO entries (id, lexeme, created_by_user_id, updated_by_user_id) VALUES ('e1', '{}', 'u1', 'u1')`).run()
    db.prepare(`INSERT INTO senses (id, entry_id, created_by_user_id, updated_by_user_id) VALUES ('s1', 'e1', 'u1', 'u1')`).run()
    const cursor = read_server_seq_counter(db)

    db.prepare(`INSERT INTO deletes (table_name, id) VALUES ('entries', 'e1')`).run()

    expect(db.prepare(`SELECT 1 FROM entries WHERE id = 'e1'`).get()).toBeFalsy()
    expect(db.prepare(`SELECT 1 FROM senses WHERE id = 's1'`).get()).toBeFalsy()
    const tombstone = db.prepare(`SELECT server_seq FROM deletes WHERE id = 'e1'`).get() as { server_seq: number }
    // eslint-disable-next-line no-restricted-syntax -- the cascade may or may not consume intermediate seqs; only "above the cursor" matters
    expect(tombstone.server_seq).toBeGreaterThan(cursor)
    db.close()
  })
})
