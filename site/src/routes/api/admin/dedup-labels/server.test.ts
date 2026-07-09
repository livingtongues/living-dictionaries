import type Database from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_shared_db } from '$lib/db/server/shared-db'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { POST } from './+server'

let shared: ReturnType<typeof open_shared_db>
const dict_dbs = new Map<string, Database.Database>()

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => shared }
})

vi.mock('$lib/db/server/dictionary-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/dictionary-db')>('$lib/db/server/dictionary-db')
  return {
    ...actual,
    get_dictionary_db: (dict_id: string) => dict_dbs.get(dict_id),
    dictionary_db_path: (dict_id: string) => `/fake/${dict_id}.db`,
  }
})

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return { ...actual, existsSync: (path: string) => (typeof path === 'string' && path.startsWith('/fake/') ? true : actual.existsSync(path)) }
})

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

const USER = 'user-1'

function insert_dict(id: string) {
  shared.prepare(`INSERT INTO dictionaries (id, name, updated_at) VALUES (?, ?, ?)`).run(id, id, '2025-01-01T00:00:00Z')
  const db = open_dictionary_db_in_memory(id)
  dict_dbs.set(id, db)
  return db
}

function seed_dupes(db: Database.Database) {
  db.prepare(`INSERT INTO entries (id, lexeme, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?)`)
    .run('e1', JSON.stringify({ default: 'x' }), USER, USER)
  for (const [id, at] of [['t1', '2025-01-01T00:00:00Z'], ['t2', '2025-02-01T00:00:00Z']]) {
    db.prepare(`INSERT INTO tags (id, name, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, 'above', ?, ?, ?, ?)`)
      .run(id, USER, at, USER, at)
    db.prepare(`INSERT INTO entry_tags (id, entry_id, tag_id, created_by_user_id, updated_by_user_id) VALUES (?, 'e1', ?, ?, ?)`)
      .run(`et-${id}`, id, USER, USER)
  }
}

beforeEach(() => {
  shared = open_shared_db(':memory:')
  dict_dbs.clear()
})

afterEach(() => {
  shared.close()
  for (const db of dict_dbs.values()) db.close()
})

function call(body: unknown, token?: string) {
  const request = new Request('http://localhost/api/admin/dedup-labels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const cookies = { get: (name: string) => (name === 'session' ? token : undefined) }
  return POST({ request, cookies } as unknown as Parameters<typeof POST>[0])
}

const super_admin_token = () => sign_jwt({ sub: USER, email: 'jwrunner7@gmail.com', name: 'Jacob' })
const level2_token = () => sign_jwt({ sub: 'u2', email: 'livingtongues@gmail.com', name: 'Greg' })

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ dry_run: true })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for a level-2 admin', async () => {
    await expect(call({ dry_run: true }, await level2_token())).rejects.toMatchObject({ status: 403 })
  })

  test('400 when dry_run missing', async () => {
    await expect(call({}, await super_admin_token())).rejects.toMatchObject({ status: 400 })
  })

  test('dry_run reports counts without writing or bumping the catalog', async () => {
    const db = insert_dict('dict-a')
    seed_dupes(db)

    const response = await call({ dry_run: true }, await super_admin_token())
    const body = await response.json()

    expect(body.dry_run).toBeTruthy()
    expect(body.dicts_scanned).toBe(1)
    expect(body.dicts_affected).toBe(1)
    expect(body.totals.tags_removed).toBe(1)
    expect(body.per_dict[0].dict_id).toBe('dict-a')
    // nothing written
    expect((db.prepare(`SELECT COUNT(*) c FROM tags`).get() as { c: number }).c).toBe(2)
    const cat = shared.prepare(`SELECT updated_at FROM dictionaries WHERE id = 'dict-a'`).get() as { updated_at: string }
    expect(cat.updated_at).toBe('2025-01-01T00:00:00Z')
  })

  test('real run tombstones dups and bumps the affected dict catalog', async () => {
    const db = insert_dict('dict-a')
    seed_dupes(db)
    insert_dict('dict-b') // clean, untouched

    const response = await call({ dry_run: false }, await super_admin_token())
    const body = await response.json()

    expect(body.dry_run).toBeFalsy()
    expect(body.dicts_scanned).toBe(2)
    expect(body.dicts_affected).toBe(1)
    expect(body.totals.tags_removed).toBe(1)
    expect((db.prepare(`SELECT COUNT(*) c FROM tags`).get() as { c: number }).c).toBe(1)
    expect((db.prepare(`SELECT COUNT(*) c FROM deletes WHERE table_name = 'tags'`).get() as { c: number }).c).toBe(1)
    // affected dict's catalog bumped, clean dict untouched
    const bumped = shared.prepare(`SELECT updated_at FROM dictionaries WHERE id = 'dict-a'`).get() as { updated_at: string }
    expect(bumped.updated_at).not.toBe('2025-01-01T00:00:00Z')
    const clean = shared.prepare(`SELECT updated_at FROM dictionaries WHERE id = 'dict-b'`).get() as { updated_at: string }
    expect(clean.updated_at).toBe('2025-01-01T00:00:00Z')
  })
})
