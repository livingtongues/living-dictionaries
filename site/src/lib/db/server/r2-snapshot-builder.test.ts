import type { PutObjectCommand } from '@aws-sdk/client-s3'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_shared_db } from './shared-db'
import { sweep_dirty_dictionaries } from './r2-snapshot-builder'

let shared: ReturnType<typeof open_shared_db>
const dict_dbs = new Map<string, Database.Database>()
const put_spy = vi.fn((_command: PutObjectCommand) => Promise.resolve())

vi.mock('./shared-db', async () => {
  const actual = await vi.importActual<typeof import('./shared-db')>('./shared-db')
  return { ...actual, get_shared_db: () => shared }
})

vi.mock('./dictionary-db', () => ({
  get_dictionary_db: (dict_id: string) => dict_dbs.get(dict_id),
}))

vi.mock('$lib/r2/snapshot-client', () => ({
  get_r2_snapshot_client: () => ({ client: { send: put_spy }, bucket: 'test-snapshots' }),
}))

function make_dict_db(): Database.Database {
  const db = new Database(':memory:')
  db.exec('CREATE TABLE entries (id TEXT PRIMARY KEY, lexeme TEXT)')
  db.prepare('INSERT INTO entries (id, lexeme) VALUES (?, ?)').run('e1', 'hello')
  return db
}

function insert_dict({ id, updated_at, snapshot_uploaded_at }: {
  id: string
  updated_at: string
  snapshot_uploaded_at: string | null
}) {
  shared.prepare(
    `INSERT INTO dictionaries (id, name, updated_at, snapshot_uploaded_at) VALUES (?, ?, ?, ?)`,
  ).run(id, id, updated_at, snapshot_uploaded_at)
  dict_dbs.set(id, make_dict_db())
}

beforeEach(() => {
  vi.clearAllMocks()
  shared = open_shared_db(':memory:')
  dict_dbs.clear()
})

afterEach(() => {
  shared.close()
  for (const db of dict_dbs.values()) db.close()
})

describe(sweep_dirty_dictionaries, () => {
  test('uploads only dictionaries whose updated_at is newer than snapshot_uploaded_at', async () => {
    insert_dict({ id: 'never-built', updated_at: '2026-01-02T00:00:00.000Z', snapshot_uploaded_at: null })
    insert_dict({ id: 'stale', updated_at: '2026-03-01T00:00:00.000Z', snapshot_uploaded_at: '2026-02-01T00:00:00.000Z' })
    insert_dict({ id: 'fresh', updated_at: '2026-02-01T00:00:00.000Z', snapshot_uploaded_at: '2026-03-01T00:00:00.000Z' })

    const result = await sweep_dirty_dictionaries()

    expect(result).toEqual({ uploaded: 2 })
    expect(put_spy).toHaveBeenCalledTimes(2)
    const uploaded_keys = put_spy.mock.calls.map(([command]) => command.input.Key).sort()
    expect(uploaded_keys).toEqual(['dictionaries/never-built.db.gz', 'dictionaries/stale.db.gz'])
  })

  test('bumps snapshot_uploaded_at for uploaded dictionaries', async () => {
    insert_dict({ id: 'd1', updated_at: '2026-01-01T00:00:00.000Z', snapshot_uploaded_at: null })

    await sweep_dirty_dictionaries()

    const row = shared.prepare(`SELECT snapshot_uploaded_at FROM dictionaries WHERE id = 'd1'`).get() as { snapshot_uploaded_at: string }
    expect(row.snapshot_uploaded_at > '2026-01-01T00:00:00.000Z').toBeTruthy()
  })

  test('no-ops when nothing is dirty', async () => {
    insert_dict({ id: 'fresh', updated_at: '2026-01-01T00:00:00.000Z', snapshot_uploaded_at: '2026-02-01T00:00:00.000Z' })

    const result = await sweep_dirty_dictionaries()

    expect(result).toEqual({ uploaded: 0 })
    expect(put_spy).not.toHaveBeenCalled()
  })

  test('uploads gzip-encoded octet-stream to the snapshots bucket', async () => {
    insert_dict({ id: 'd1', updated_at: '2026-01-01T00:00:00.000Z', snapshot_uploaded_at: null })

    await sweep_dirty_dictionaries()

    const [[command]] = put_spy.mock.calls
    expect(command.input.Bucket).toBe('test-snapshots')
    expect(command.input.ContentEncoding).toBe('gzip')
    expect(command.input.ContentType).toBe('application/octet-stream')
    expect(command.input.Body).toBeInstanceOf(Uint8Array)
  })

  test('prunes tombstones older than the snapshot-expiry window from the source db', async () => {
    insert_dict({ id: 'd1', updated_at: '2026-01-01T00:00:00.000Z', snapshot_uploaded_at: null })
    const dict_db = dict_dbs.get('d1')
    dict_db.exec(`CREATE TABLE deletes (table_name TEXT NOT NULL, id TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (table_name, id))`)
    const ancient = '2020-01-01T00:00:00.000Z'
    const fresh = new Date().toISOString()
    dict_db.prepare(`INSERT INTO deletes (table_name, id, updated_at) VALUES ('entries', 'old', ?)`).run(ancient)
    dict_db.prepare(`INSERT INTO deletes (table_name, id, updated_at) VALUES ('entries', 'recent', ?)`).run(fresh)

    await sweep_dirty_dictionaries()

    const remaining = dict_db.prepare(`SELECT id FROM deletes`).all() as { id: string }[]
    expect(remaining).toEqual([{ id: 'recent' }])
  })
})
