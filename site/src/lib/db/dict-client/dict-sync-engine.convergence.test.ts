import type BetterSqlite3 from 'better-sqlite3'
import type { EngineConnection } from './dict-sync-engine'
import type { DictSyncableTable } from '$lib/db/dict-syncable-tables'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { DICT_NATURAL_KEY_COLUMNS, process_dict_changes } from '$lib/db/server/dictionary-sync-helpers'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DictSyncEngine } from './dict-sync-engine'

vi.mock('$api/log/_call', () => ({
  api_log: vi.fn(() => Promise.resolve({ data: null, error: null })),
}))

/**
 * GENERALIZED end-to-end convergence proof for EVERY `DICT_NATURAL_KEY_COLUMNS`
 * table — LD's port of house's `worker-engine.natural-key-convergence.test.ts`
 * (cross-app hardening Part 3, house's Wayne wedge 2026-07-08).
 *
 * The server-side adopt-canonical dedup (2026-07-07) was a HALF-fix: it stopped
 * the server 500 but never told the pushing client to drop its loser row — so
 * applying the pulled canonical row threw the SAME `UNIQUE constraint failed`
 * client-side, the apply transaction rolled back, dirty never cleared, and the
 * push retried every 30s forever. Only a full round trip through REAL dict
 * migrations on both sides + the REAL `DictSyncEngine` catches that, so this
 * drives one per table:
 *
 *   client (dirty loser id) ⇄ real `process_dict_changes` (canonical id lives
 *   server-side) → client must converge onto the canonical id with dirty +
 *   tombstones drained.
 *
 * A coverage guard fails this file whenever a table is added to
 * `DICT_NATURAL_KEY_COLUMNS` without a spec here.
 */

const T0 = '2026-07-09T00:00:00.000Z'
const T1 = '2026-07-09T00:00:01.000Z'

let server_db: ReturnType<typeof open_dictionary_db_in_memory>
let client_db: ReturnType<typeof open_dictionary_db_in_memory>

function connection_for(db: BetterSqlite3.Database): EngineConnection {
  return {
    query: <T>(sql: string, params: unknown[] = []) => Promise.resolve(db.prepare(sql).all(...params) as T[]),
    execute: (sql: string, params?: unknown[]) => {
      if (params?.length)
        db.prepare(sql).run(...params)
      else
        db.exec(sql)
      return Promise.resolve()
    },
  }
}

function make_engine() {
  return new DictSyncEngine({
    dict_id: 'test-dict',
    connection: connection_for(client_db),
    has_editor_role: true,
    get_auth: () => ({}) as never,
  })
}

beforeEach(() => {
  server_db = open_dictionary_db_in_memory('server')
  client_db = open_dictionary_db_in_memory('client')
  // The real endpoint delegates to process_dict_changes after auth + version
  // handshake; stub fetch to do exactly the delegation part.
  vi.stubGlobal('fetch', (_url: string, init: { body: string }) => {
    try {
      const request = JSON.parse(init.body)
      const data = process_dict_changes({ db: server_db, request, user_id: 'server_user', is_editor: true })
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
    } catch (error) {
      return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve((error as Error).message) })
    }
  })
})

afterEach(() => {
  server_db.close()
  client_db.close()
  vi.unstubAllGlobals()
})

/** Parent fixtures — applied to BOTH DBs (dirty NULL, so never pushed). */
const PARENTS: Record<string, string> = {
  entry: `INSERT INTO entries (id, lexeme, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('ent-1', '{}', 'u1', 'u1', '${T0}', '${T0}')`,
  entry_b: `INSERT INTO entries (id, lexeme, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('ent-2', '{}', 'u1', 'u1', '${T0}', '${T0}')`,
  sense: `INSERT INTO senses (id, entry_id, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('sen-1', 'ent-1', 'u1', 'u1', '${T0}', '${T0}')`,
  sentence: `INSERT INTO sentences (id, text, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('stc-1', '{}', 'u1', 'u1', '${T0}', '${T0}')`,
  speaker: `INSERT INTO speakers (id, name, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('spk-1', 'Speaker', 'u1', 'u1', '${T0}', '${T0}')`,
  audio: `INSERT INTO audio (id, entry_id, storage_path, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('aud-1', 'ent-1', 'audio/a.mp3', 'u1', 'u1', '${T0}', '${T0}')`,
  video: `INSERT INTO videos (id, storage_path, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('vid-1', 'video/v.mp4', 'u1', 'u1', '${T0}', '${T0}')`,
  photo: `INSERT INTO photos (id, storage_path, serving_url, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('pho-1', 'photos/p.jpg', 'https://p', 'u1', 'u1', '${T0}', '${T0}')`,
  dialect: `INSERT INTO dialects (id, name, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('dia-1', '{}', 'u1', 'u1', '${T0}', '${T0}')`,
  tag: `INSERT INTO tags (id, name, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('tag-1', 'Tag', 'u1', 'u1', '${T0}', '${T0}')`,
}

/** The identical natural-key values BOTH colliding rows carry (plus any extra required columns). */
const SPECS: Partial<Record<DictSyncableTable, { parents: (keyof typeof PARENTS)[], columns: Record<string, string> }>> = {
  senses_in_sentences: { parents: ['entry', 'sense', 'sentence'], columns: { sense_id: 'sen-1', sentence_id: 'stc-1' } },
  audio_speakers: { parents: ['entry', 'audio', 'speaker'], columns: { audio_id: 'aud-1', speaker_id: 'spk-1' } },
  video_speakers: { parents: ['video', 'speaker'], columns: { video_id: 'vid-1', speaker_id: 'spk-1' } },
  sense_videos: { parents: ['entry', 'sense', 'video'], columns: { sense_id: 'sen-1', video_id: 'vid-1' } },
  sentence_videos: { parents: ['sentence', 'video'], columns: { sentence_id: 'stc-1', video_id: 'vid-1' } },
  sense_photos: { parents: ['entry', 'sense', 'photo'], columns: { sense_id: 'sen-1', photo_id: 'pho-1' } },
  sentence_photos: { parents: ['sentence', 'photo'], columns: { sentence_id: 'stc-1', photo_id: 'pho-1' } },
  entry_dialects: { parents: ['entry', 'dialect'], columns: { entry_id: 'ent-1', dialect_id: 'dia-1' } },
  entry_tags: { parents: ['entry', 'tag'], columns: { entry_id: 'ent-1', tag_id: 'tag-1' } },
  featured_entries: { parents: ['entry'], columns: { entry_id: 'ent-1', sort_key: 'a0' } },
  sources: { parents: [], columns: { slug: 'shared-source' } },
  entry_relationships: { parents: ['entry', 'entry_b'], columns: { from_entry_id: 'ent-1', to_entry_id: 'ent-2', type: 'synonym' } },
  ignored_forms: { parents: [], columns: { form: 'shared-form' } },
}

/** Natural-key columns only (what the dedup matches on) — SPECS may add required extras like sort_key. */
function natural_key_of(table: DictSyncableTable, columns: Record<string, string>): Record<string, string> {
  const key_columns = DICT_NATURAL_KEY_COLUMNS[table] ?? []
  return Object.fromEntries(key_columns.filter(column => column in columns).map(column => [column, columns[column]]))
}

function insert_row({ db, table, id, columns, dirty, updated_at }: {
  db: BetterSqlite3.Database
  table: string
  id: string
  columns: Record<string, string>
  dirty?: boolean
  updated_at: string
}) {
  const names = ['id', ...Object.keys(columns), 'dirty', 'created_by_user_id', 'updated_by_user_id', 'created_at', 'updated_at']
  const values = [id, ...Object.values(columns), dirty ? 1 : null, 'u1', 'u1', T0, updated_at]
  db.prepare(
    `INSERT INTO "${table}" (${names.map(name => `"${name}"`).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
  ).run(...values)
}

function expect_converged({ table, columns }: { table: DictSyncableTable, columns: Record<string, string> }) {
  const key = natural_key_of(table, columns)
  const where_sql = Object.keys(key).map(column => `"${column}" = ?`).join(' AND ')
  const params = Object.values(key)
  for (const [side, db] of [['client', client_db], ['server', server_db]] as const) {
    // Exactly ONE row owns the natural key, under the CANONICAL (server) id.
    const rows = db.prepare(`SELECT id FROM "${table}" WHERE ${where_sql}`).all(...params) as { id: string }[]
    expect({ side, table, rows }).toEqual({ side, table, rows: [{ id: 'row-canon' }] })
    const loser = db.prepare(`SELECT id FROM "${table}" WHERE id = 'row-loser'`).get()
    expect({ side, table, loser }).toEqual({ side, table, loser: undefined })
  }
  // The wedge loop is broken: nothing dirty, no tombstones queued client-side.
  const { n: dirty } = client_db.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE dirty = 1`).get() as { n: number }
  expect(dirty).toBe(0)
  const { n: deletes } = client_db.prepare('SELECT COUNT(*) AS n FROM deletes').get() as { n: number }
  expect(deletes).toBe(0)
}

describe('natural-key convergence coverage guard', () => {
  test('every DICT_NATURAL_KEY_COLUMNS table has a convergence spec', () => {
    expect(Object.keys(SPECS).sort()).toEqual(Object.keys(DICT_NATURAL_KEY_COLUMNS).sort())
  })
})

/**
 * Stale-file convergence (the 2026-07-13 tutelo-saponi stuck-"Loading" fix):
 * a pre-server_seq OPFS file has `last_modified_at` but NO `synced_seq` →
 * the engine reads a null cursor and must converge IN PLACE via a full pull
 * with prune-to-response — no snapshot reset, no connection teardown. The
 * server sends no tombstones for a null cursor, so without the prune, rows
 * deleted server-side since the file's last sync would linger as ghosts.
 */
describe('stale-file (null-cursor) full-pull convergence', () => {
  function insert_entry(db: BetterSqlite3.Database, { id, dirty = false }: { id: string, dirty?: boolean }) {
    db.prepare(
      `INSERT INTO entries (id, lexeme, dirty, created_by_user_id, updated_by_user_id, created_at, updated_at)
       VALUES (?, '{}', ?, 'u1', 'u1', ?, ?)`,
    ).run(id, dirty ? 1 : null, T0, T0)
  }

  function make_stale_client() {
    // The pre-2026-07-09 cursor state: old ISO watermark present, seq cursor absent.
    client_db.prepare(`INSERT INTO db_metadata (key, value) VALUES ('last_modified_at', ?)`).run(T0)
    client_db.prepare(`DELETE FROM db_metadata WHERE key = 'synced_seq'`).run()
  }

  test('converges in place: ghosts pruned, new rows pulled, dirty work pushed, synced_seq written', async () => {
    make_stale_client()
    insert_entry(server_db, { id: 'ent-live' })
    insert_entry(server_db, { id: 'ent-new' }) // written server-side after the stale file's last sync
    insert_entry(client_db, { id: 'ent-live' })
    insert_entry(client_db, { id: 'ent-ghost' }) // deleted server-side; tombstone unavailable to a null cursor
    insert_entry(client_db, { id: 'ent-dirty', dirty: true }) // un-pushed local work — must survive + push

    const deleted: { table_name: string, id: string }[] = []
    const engine = new DictSyncEngine({
      dict_id: 'test-dict',
      connection: connection_for(client_db),
      has_editor_role: true,
      get_auth: () => ({}) as never,
      on_rows_deleted: rows => deleted.push(...rows),
    })
    await expect(engine.sync_once()).resolves.toBeTruthy()

    const client_ids = client_db.prepare(`SELECT id FROM entries ORDER BY id`).all() as { id: string }[]
    expect(client_ids).toEqual([{ id: 'ent-dirty' }, { id: 'ent-live' }, { id: 'ent-new' }])
    const server_ids = server_db.prepare(`SELECT id FROM entries ORDER BY id`).all() as { id: string }[]
    expect(server_ids).toEqual([{ id: 'ent-dirty' }, { id: 'ent-live' }, { id: 'ent-new' }])
    expect(deleted).toEqual([{ table_name: 'entries', id: 'ent-ghost' }])

    // Cursor persisted → the file is healed, never a null cursor again.
    const cursor_row = client_db.prepare(`SELECT value FROM db_metadata WHERE key = 'synced_seq'`).get() as { value: string }
    const server_counter = server_db.prepare(`SELECT seq FROM server_seq_counter`).get() as { seq: number }
    expect(Number(cursor_row.value)).toBe(server_counter.seq)

    // Nothing left dirty, and the next sync is a clean incremental no-op.
    const { n: dirty } = client_db.prepare(`SELECT COUNT(*) AS n FROM entries WHERE dirty = 1`).get() as { n: number }
    expect(dirty).toBe(0)
    await expect(engine.sync_once()).resolves.toBeTruthy()
    expect(client_db.prepare(`SELECT COUNT(*) AS n FROM entries`).get()).toEqual({ n: 3 })
  })

  test('an incremental (non-null cursor) sync never prunes', async () => {
    insert_entry(server_db, { id: 'ent-live' })
    insert_entry(client_db, { id: 'ent-live' })
    insert_entry(client_db, { id: 'ent-local-only' }) // stale-but-clean row an incremental pull must NOT touch
    const server_counter = server_db.prepare(`SELECT seq FROM server_seq_counter`).get() as { seq: number }
    client_db.prepare(
      `INSERT INTO db_metadata (key, value) VALUES ('synced_seq', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(String(server_counter.seq))

    const engine = new DictSyncEngine({
      dict_id: 'test-dict',
      connection: connection_for(client_db),
      has_editor_role: true,
      get_auth: () => ({}) as never,
    })
    await expect(engine.sync_once()).resolves.toBeTruthy()

    const ids = client_db.prepare(`SELECT id FROM entries ORDER BY id`).all() as { id: string }[]
    expect(ids).toEqual([{ id: 'ent-live' }, { id: 'ent-local-only' }])
  })
})

describe('adopt-canonical convergence: a client whose fresh-minted duplicate collides converges instead of wedging', () => {
  for (const [table, spec] of Object.entries(SPECS) as [DictSyncableTable, NonNullable<typeof SPECS[DictSyncableTable]>][]) {
    test(table, async () => {
      for (const db of [server_db, client_db]) {
        for (const parent of spec.parents)
          db.exec(PARENTS[parent])
      }
      insert_row({ db: server_db, table, id: 'row-canon', columns: spec.columns, updated_at: T0 })
      insert_row({ db: client_db, table, id: 'row-loser', columns: spec.columns, dirty: true, updated_at: T1 })

      const engine = make_engine()
      // Pre-fix this threw `UNIQUE constraint failed: <table>.<column>` INSIDE
      // the client apply transaction (the echoed canonical row collided with
      // the local loser that still owned the natural key).
      await expect(engine.sync_once()).resolves.toBeTruthy()

      expect_converged({ table, columns: spec.columns })

      // And the next sync is a clean no-op.
      await expect(engine.sync_once()).resolves.toBeTruthy()
    })
  }

  test('the LWW-losing direction converges too (older loser push still drops the loser + adopts canonical)', async () => {
    for (const db of [server_db, client_db]) {
      db.exec(PARENTS.entry)
      db.exec(PARENTS.tag)
    }
    // Canonical row is NEWER than the pushed loser — merge_dict_row's server-wins
    // early return must still tombstone the loser or the client wedges.
    insert_row({ db: server_db, table: 'entry_tags', id: 'row-canon', columns: { entry_id: 'ent-1', tag_id: 'tag-1' }, updated_at: T1 })
    insert_row({ db: client_db, table: 'entry_tags', id: 'row-loser', columns: { entry_id: 'ent-1', tag_id: 'tag-1' }, dirty: true, updated_at: T0 })

    const engine = make_engine()
    await expect(engine.sync_once()).resolves.toBeTruthy()
    expect_converged({ table: 'entry_tags', columns: { entry_id: 'ent-1', tag_id: 'tag-1' } })
  })
})
