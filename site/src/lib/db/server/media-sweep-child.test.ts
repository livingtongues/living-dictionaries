import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { shared_db_mock } = vi.hoisted(() => ({ shared_db_mock: { current: null as Database.Database | null } }))
vi.mock('./shared-db', async original_import => ({
  ...(await original_import<typeof import('./shared-db')>()),
  get_shared_db: () => shared_db_mock.current!,
}))

const { live_keys_for_dict, orphan_brake_tripped } = await import('./media-sweep-child')
const { open_test_shared_db } = await import('./shared-db')

/**
 * The property under test is the one that protects real user media: an
 * UNREADABLE dictionary must never be reported as "references nothing", because
 * that answer marks its entire library as orphaned and starts a 30-day deletion
 * countdown. (2026-08-02 — see the module header.)
 */
let data_dir: string
let previous_data_dir: string | undefined
const PHOTO_UUID = '48af49b0-b410-4db1-babf-38ac53269e62'

function add_dictionary(id: string): void {
  shared_db_mock.current!.prepare(`INSERT INTO dictionaries (id, name) VALUES (?, ?)`).run(id, id)
}

function write_dict_db(id: string, { tables = ['audio', 'videos', 'photos'], paths = [] as string[] }: { tables?: string[], paths?: string[] } = {}): void {
  const db = new Database(join(data_dir, 'dictionaries', `${id}.db`))
  for (const table of tables)
    db.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY, storage_path TEXT)`)
  if (tables.includes('photos')) {
    const insert = db.prepare(`INSERT INTO photos (id, storage_path) VALUES (?, ?)`)
    paths.forEach((path, index) => insert.run(`p${index}`, path))
  }
  db.close()
}

beforeEach(() => {
  previous_data_dir = process.env.DATA_DIR
  data_dir = mkdtempSync(join(tmpdir(), 'media-sweep-'))
  mkdirSync(join(data_dir, 'dictionaries'), { recursive: true })
  process.env.DATA_DIR = data_dir
  shared_db_mock.current = open_test_shared_db()
})

afterEach(() => {
  shared_db_mock.current?.close()
  if (previous_data_dir === undefined)
    delete process.env.DATA_DIR
  else
    process.env.DATA_DIR = previous_data_dir
  rmSync(data_dir, { recursive: true, force: true })
})

describe(live_keys_for_dict, () => {
  test('reads the live storage paths of a healthy dictionary', () => {
    const photo_key = `healthy/photo/${PHOTO_UUID}.jpg`
    add_dictionary('healthy')
    write_dict_db('healthy', { paths: [photo_key] })

    const result = live_keys_for_dict('healthy')

    expect(result.ok).toBeTruthy()
    expect(result.dictionary_deleted).toBeFalsy()
    expect(result.keys.has(photo_key)).toBeTruthy()
    // Derived variants are live too — the sweep must never delete a generated WebP.
    expect(result.keys.has(`healthy/photo/${PHOTO_UUID}_thumb.webp`)).toBeTruthy()
  })

  test('a MISSING dictionary db is a failed read, not an empty dictionary', () => {
    add_dictionary('vanished') // still in the catalog: the file should be there

    const result = live_keys_for_dict('vanished')

    expect(result.ok).toBeFalsy()
    expect(result.keys.size).toBe(0) // …and the caller must not read this as "nothing is in use"
    expect(result.error).toBeTruthy()
  })

  test('a CORRUPT dictionary db is a failed read', () => {
    add_dictionary('corrupt')
    writeFileSync(join(data_dir, 'dictionaries', 'corrupt.db'), 'this is not a sqlite file')

    expect(live_keys_for_dict('corrupt').ok).toBeFalsy()
  })

  test('a db with none of the media tables is a failed read (we did not actually read anything)', () => {
    add_dictionary('shapeless')
    write_dict_db('shapeless', { tables: ['entries'] })

    expect(live_keys_for_dict('shapeless').ok).toBeFalsy()
  })

  test('a dictionary DELETED from the catalog legitimately references nothing — reclamation still works', () => {
    // No catalog row, no file: the dictionary is gone on purpose.
    const result = live_keys_for_dict('deleted-dict')

    expect(result.ok).toBeTruthy()
    expect(result.dictionary_deleted).toBeTruthy()
    expect(result.keys.size).toBe(0)
  })
})

describe(orphan_brake_tripped, () => {
  test('refuses an implausible share of one dictionary going unreferenced at once', () => {
    expect(orphan_brake_tripped({ objects: 100, newly_orphaned: 100, dictionary_deleted: false })).toBeTruthy()
    expect(orphan_brake_tripped({ objects: 100, newly_orphaned: 51, dictionary_deleted: false })).toBeTruthy()
  })

  test('lets ordinary cleanup through', () => {
    expect(orphan_brake_tripped({ objects: 100, newly_orphaned: 50, dictionary_deleted: false })).toBeFalsy()
    expect(orphan_brake_tripped({ objects: 100, newly_orphaned: 3, dictionary_deleted: false })).toBeFalsy()
    // A tiny dictionary replacing both its photos is normal editing, not an alarm.
    expect(orphan_brake_tripped({ objects: 2, newly_orphaned: 2, dictionary_deleted: false })).toBeFalsy()
  })

  test('never brakes a deleted dictionary — emptying it is the point', () => {
    expect(orphan_brake_tripped({ objects: 500, newly_orphaned: 500, dictionary_deleted: true })).toBeFalsy()
  })

  test('a dictionary already fully orphaned in an earlier sweep does not re-trip it', () => {
    // Nothing is NEWLY orphaned this run, however much is already marked.
    expect(orphan_brake_tripped({ objects: 300, newly_orphaned: 0, dictionary_deleted: false })).toBeFalsy()
  })
})
