import type { PutObjectCommand } from '@aws-sdk/client-s3'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import Database from 'better-sqlite3'
import { rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_test_shared_db } from './shared-db'
import { run_r2_snapshot_sweep, sweep_dirty_dictionaries } from './r2-snapshot-builder'

let shared: ReturnType<typeof open_test_shared_db>
const dict_dbs = new Map<string, Database.Database>()
const put_spy = vi.fn((_command: PutObjectCommand | DeleteObjectCommand) => Promise.resolve())

/** Narrow a recorded command to a Put for its typed `input` (throws on a Delete). */
function put_input(command: PutObjectCommand | DeleteObjectCommand): PutObjectCommand['input'] {
  if (command instanceof DeleteObjectCommand)
    throw new Error('expected a PutObjectCommand')
  return command.input
}

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

const log_spy = vi.fn()
vi.mock('$lib/server/log-server-event', () => ({
  log_server_event: (...args: unknown[]) => log_spy(...args),
}))

function make_dict_db(): Database.Database {
  const db = new Database(':memory:')
  db.exec('CREATE TABLE entries (id TEXT PRIMARY KEY, lexeme TEXT)')
  db.prepare('INSERT INTO entries (id, lexeme) VALUES (?, ?)').run('e1', 'hello')
  return db
}

function insert_dict({ id, updated_at, snapshot_uploaded_at, bucket = null }: {
  id: string
  updated_at: string
  snapshot_uploaded_at: string | null
  bucket?: string | null
}) {
  shared.prepare(
    `INSERT INTO dictionaries (id, name, updated_at, snapshot_uploaded_at, bucket) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, id, updated_at, snapshot_uploaded_at, bucket)
  dict_dbs.set(id, make_dict_db())
}

beforeEach(() => {
  vi.clearAllMocks()
  shared = open_test_shared_db()
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

    expect(result).toMatchObject({ uploaded: 2, deleted: 0, failed: 0 })
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

    expect(result).toMatchObject({ uploaded: 0, deleted: 0, bytes_uploaded: 0, slowest_dict: null })
    expect(put_spy).not.toHaveBeenCalled()
  })

  test('never uploads a secure dictionary, even when dirty', async () => {
    insert_dict({ id: 'hidden', updated_at: '2026-03-01T00:00:00.000Z', snapshot_uploaded_at: null, bucket: 'secure' })
    insert_dict({ id: 'open', updated_at: '2026-03-01T00:00:00.000Z', snapshot_uploaded_at: null, bucket: 'public' })

    const result = await sweep_dirty_dictionaries()

    expect(result).toMatchObject({ uploaded: 1, deleted: 0, failed: 0 })
    expect(put_spy.mock.calls.map(([command]) => command.input.Key)).toEqual(['dictionaries/open.db.gz'])
  })

  test('deletes the lingering public snapshot of a dictionary flipped to secure and clears its watermark', async () => {
    insert_dict({ id: 'hidden', updated_at: '2026-01-01T00:00:00.000Z', snapshot_uploaded_at: '2026-02-01T00:00:00.000Z', bucket: 'secure' })

    const result = await sweep_dirty_dictionaries()

    expect(result).toMatchObject({ uploaded: 0, deleted: 1 })
    expect(put_spy).toHaveBeenCalledTimes(1)
    const [[command]] = put_spy.mock.calls
    expect(command).toBeInstanceOf(DeleteObjectCommand)
    expect(command.input).toEqual({ Bucket: 'test-snapshots', Key: 'dictionaries/hidden.db.gz' })
    const row = shared.prepare(`SELECT snapshot_uploaded_at FROM dictionaries WHERE id = 'hidden'`).get() as { snapshot_uploaded_at: string | null }
    expect(row.snapshot_uploaded_at).toBe(null)
  })

  test('uploads gzip bytes as an OPAQUE blob — no ContentEncoding, so no CDN can transparently decompress it (house\'s zone did, serving 2.4× the bytes)', async () => {
    insert_dict({ id: 'd1', updated_at: '2026-01-01T00:00:00.000Z', snapshot_uploaded_at: null })

    await sweep_dirty_dictionaries()

    const [[command]] = put_spy.mock.calls
    const input = put_input(command)
    expect(input.Bucket).toBe('test-snapshots')
    expect(input.ContentEncoding).toBe(undefined)
    expect(input.ContentType).toBe('application/octet-stream')
    expect(input.Body).toBeInstanceOf(Uint8Array)
    const body = input.Body as Uint8Array
    expect([body[0], body[1]]).toEqual([0x1F, 0x8B]) // gzip magic bytes
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

  test('on a seq-migrated source: records pruned_up_to_seq before pruning + bakes synced_seq into the snapshot', async () => {
    insert_dict({ id: 'd1', updated_at: '2026-01-01T00:00:00.000Z', snapshot_uploaded_at: null })
    const dict_db = dict_dbs.get('d1')
    dict_db.exec(`
      CREATE TABLE deletes (table_name TEXT NOT NULL, id TEXT NOT NULL, updated_at TEXT NOT NULL, server_seq INTEGER, PRIMARY KEY (table_name, id));
      CREATE TABLE db_metadata (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE server_seq_counter (seq INTEGER NOT NULL);
      INSERT INTO server_seq_counter (seq) VALUES (42);
    `)
    const ancient = '2020-01-01T00:00:00.000Z'
    dict_db.prepare(`INSERT INTO deletes (table_name, id, updated_at, server_seq) VALUES ('entries', 'old_a', ?, 7)`).run(ancient)
    dict_db.prepare(`INSERT INTO deletes (table_name, id, updated_at, server_seq) VALUES ('entries', 'old_b', ?, 9)`).run(ancient)
    dict_db.prepare(`INSERT INTO deletes (table_name, id, updated_at, server_seq) VALUES ('entries', 'recent', ?, 40)`).run(new Date().toISOString())

    await sweep_dirty_dictionaries()

    // Highest PRUNED seq recorded (the /changes 410 boundary), pruning applied.
    const pruned_meta = dict_db.prepare(`SELECT value FROM db_metadata WHERE key = 'pruned_up_to_seq'`).get() as { value: string }
    expect(pruned_meta.value).toBe('9')
    expect((dict_db.prepare(`SELECT id FROM deletes`).all() as { id: string }[])).toEqual([{ id: 'recent' }])

    // The uploaded snapshot carries a baked cursor = the counter value, and an
    // emptied deletes log (the client's deletes table doubles as its push queue).
    const [[command]] = put_spy.mock.calls
    const snapshot_bytes = gunzipSync(Buffer.from(put_input(command).Body as Uint8Array))
    const temp_path = join(tmpdir(), `snapshot-test-${crypto.randomUUID()}.db`)
    writeFileSync(temp_path, snapshot_bytes)
    const snapshot_db = new Database(temp_path, { readonly: true })
    try {
      const baked = snapshot_db.prepare(`SELECT value FROM db_metadata WHERE key = 'synced_seq'`).get() as { value: string }
      expect(baked.value).toBe('42')
      expect(snapshot_db.prepare(`SELECT COUNT(*) AS c FROM deletes`).get()).toEqual({ c: 0 })
    } finally {
      snapshot_db.close()
      rmSync(temp_path, { force: true })
    }
  })
})

/**
 * §1.2 of the 2026-08-02 log review: the event-loop meter caught this job freezing
 * the serving process for 6.4 s at 03:03 UTC, and it could only be INFERRED from an
 * `:03`/`:33` timestamp because the builder emitted zero telemetry — `grep` found
 * no `log_server_event` call in the whole module. These lock in the account it now
 * gives of itself.
 */
describe(run_r2_snapshot_sweep, () => {
  test('reports what the sweep cost — dictionaries, bytes, duration, per-step timings, slowest dict', async () => {
    insert_dict({ id: 'alpha', updated_at: '2026-03-01T00:00:00.000Z', snapshot_uploaded_at: null })
    insert_dict({ id: 'beta', updated_at: '2026-03-01T00:00:00.000Z', snapshot_uploaded_at: null })

    await run_r2_snapshot_sweep()

    expect(log_spy).toHaveBeenCalledTimes(1)
    const [[{ level, message, context }]] = log_spy.mock.calls
    expect(message).toBe('snapshot_sweep_completed')
    expect(level).toBe('info')
    expect(context).toMatchObject({ dictionaries: 2, deleted: 0, failed: 0 })
    // Two real gzipped snapshots were uploaded, so the byte tally must be the sum
    // of what the R2 client actually received.
    const uploaded_bytes = put_spy.mock.calls.reduce((total, [command]) => total + (put_input(command).Body as Uint8Array).byteLength, 0)
    expect(context.bytes_uploaded).toBe(uploaded_bytes)
    expect(typeof context.duration_ms).toBe('number')
    expect(typeof context.blocking_ms).toBe('number')
    // The step that is SYNCHRONOUS SQLite work on the event loop — the freeze candidate.
    expect(Object.keys(context.step_ms as Record<string, number>)).toEqual(
      expect.arrayContaining(['list_dirty', 'prune_deletes', 'backup', 'strip_and_bake', 'read_file', 'gzip', 'upload']),
    )
    expect(['alpha', 'beta']).toContain((context.slowest_dict as { id: string }).id)
  })

  test('an idle sweep stays silent — this fires every 30 minutes and logs.db is 2 GB', async () => {
    await run_r2_snapshot_sweep()
    expect(log_spy).not.toHaveBeenCalled()
  })
})
