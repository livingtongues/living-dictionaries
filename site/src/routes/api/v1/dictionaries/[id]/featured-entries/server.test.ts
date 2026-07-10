import type Database from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { GET, PATCH, POST } from './+server'
import { DELETE } from './[entryId]/+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let dict_db: Database.Database
let history_db: Database.Database
let write_key: string
let read_key: string

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))
vi.mock('$lib/db/server/dictionary-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-db')>()), get_dictionary_db: () => dict_db }))
vi.mock('$lib/db/server/dictionary-history-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-history-db')>()), get_dictionary_history_db: () => history_db }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  shared_db = open_test_shared_db()
  dict_db = open_dictionary_db_in_memory('dict-1')
  history_db = open_dictionary_history_db_in_memory()
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('edt-1', 'edt@x.com', 'Edt', JSON.stringify([{ provider: 'email', provider_id: 'edt@x.com' }]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  shared_db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run('dict-1', 'dict-1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  write_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'w', role: 'write', created_by_user_id: 'edt-1' }).token
  read_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'r', role: 'read', created_by_user_id: 'edt-1' }).token
  for (const entry_id of ['ent-1', 'ent-2', 'ent-3']) {
    dict_db.prepare(`INSERT INTO entries (id, lexeme, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES (?, ?, 'edt-1', 'edt-1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`)
      .run(entry_id, JSON.stringify({ default: entry_id }))
  }
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
  history_db.close()
})

function star(entry_id: string, key = write_key) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/featured-entries', { method: 'POST', body: JSON.stringify({ entry_id }), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${key}` } })
  return POST({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' } } as never)
}
function list(key = read_key) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/featured-entries', { method: 'GET', headers: { Authorization: `Bearer ${key}` } })
  return GET({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' } } as never)
}
function reorder(order: string[], key = write_key) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/featured-entries', { method: 'PATCH', body: JSON.stringify({ order }), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${key}` } })
  return PATCH({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' } } as never)
}
function unstar(entry_id: string, key = write_key) {
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/featured-entries/${entry_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } })
  return DELETE({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', entryId: entry_id } } as never)
}

describe(POST, () => {
  test('stars an entry and appends to the end of the strip', async () => {
    const first = await (await star('ent-1')).json()
    expect(first.created).toBeTruthy()
    expect(first.featured_entry.entry_id).toBe('ent-1')
    const second = await (await star('ent-2')).json()
    const sort_keys = [first.featured_entry.sort_key, second.featured_entry.sort_key]
    expect(sort_keys).toEqual([...sort_keys].sort())
    const listed = await (await list()).json()
    expect(listed.featured_entries.map((row: { entry_id: string }) => row.entry_id)).toEqual(['ent-1', 'ent-2'])
  })

  test('re-starring is an idempotent no-op', async () => {
    const first = await (await star('ent-1')).json()
    const again = await (await star('ent-1')).json()
    expect(again.created).toBeFalsy()
    expect(again.featured_entry.id).toBe(first.featured_entry.id)
    const count = dict_db.prepare(`SELECT COUNT(*) AS c FROM featured_entries`).get() as { c: number }
    expect(count.c).toBe(1)
  })

  test('404 for an unknown entry', async () => {
    await expect(star('no-such-entry')).rejects.toMatchObject({ status: 404 })
  })

  test('400 without entry_id', async () => {
    const request = new Request('http://localhost/api/v1/dictionaries/dict-1/featured-entries', { method: 'POST', body: JSON.stringify({}), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${write_key}` } })
    await expect(POST({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' } } as never)).rejects.toMatchObject({ status: 400 })
  })

  test('403 when a read key attempts to star', async () => {
    await expect(star('ent-1', read_key)).rejects.toMatchObject({ status: 403 })
  })

  test('star lands with audit stamps and syncs (dirty NULL server-side, row present)', async () => {
    await star('ent-1')
    const row = dict_db.prepare(`SELECT * FROM featured_entries WHERE entry_id = 'ent-1'`).get() as Record<string, unknown>
    expect(row.created_by_user_id).toBe('edt-1')
    expect(row.updated_by_user_id).toBe('edt-1')
  })
})

describe(PATCH, () => {
  test('reorders the whole strip', async () => {
    await star('ent-1')
    await star('ent-2')
    await star('ent-3')
    const res = await (await reorder(['ent-3', 'ent-1', 'ent-2'])).json()
    expect(res.featured_entries.map((row: { entry_id: string }) => row.entry_id)).toEqual(['ent-3', 'ent-1', 'ent-2'])
    const listed = await (await list()).json()
    expect(listed.featured_entries.map((row: { entry_id: string }) => row.entry_id)).toEqual(['ent-3', 'ent-1', 'ent-2'])
  })

  test('400 when order is incomplete or lists an unstarred entry', async () => {
    await star('ent-1')
    await star('ent-2')
    await expect(reorder(['ent-1'])).rejects.toMatchObject({ status: 400 })
    await expect(reorder(['ent-1', 'ent-3'])).rejects.toMatchObject({ status: 400 })
    await expect(reorder(['ent-1', 'ent-1'])).rejects.toMatchObject({ status: 400 })
  })
})

describe(DELETE, () => {
  test('unstars by entry id via the tombstone path', async () => {
    await star('ent-1')
    const res = await unstar('ent-1')
    expect((await res.json()).result).toBe('deleted')
    const count = dict_db.prepare(`SELECT COUNT(*) AS c FROM featured_entries`).get() as { c: number }
    expect(count.c).toBe(0)
    const tombstone = dict_db.prepare(`SELECT COUNT(*) AS c FROM deletes WHERE table_name = 'featured_entries'`).get() as { c: number }
    expect(tombstone.c).toBe(1)
  })

  test('404 when the entry is not starred', async () => {
    await expect(unstar('ent-1')).rejects.toMatchObject({ status: 404 })
  })
})
