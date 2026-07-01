import type Database from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { apply_entry_writes } from '$lib/db/server/v1-entry-write'
import { open_shared_db } from '$lib/db/server/shared-db'
import { GET, POST } from './+server'
import { DELETE } from './[sourceId]/+server'

let shared_db: ReturnType<typeof open_shared_db>
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
  shared_db = open_shared_db(':memory:')
  dict_db = open_dictionary_db_in_memory('dict-1')
  history_db = open_dictionary_history_db_in_memory()
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('edt-1', 'edt@x.com', 'Edt', JSON.stringify([]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  shared_db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run('dict-1', 'dict-1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  write_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'w', role: 'write', created_by_user_id: 'edt-1' }).token
  read_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'r', role: 'read', created_by_user_id: 'edt-1' }).token
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
  history_db.close()
})

function post_source(body: unknown, key = write_key) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/sources', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${key}` } })
  return POST({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' }, url: new URL(request.url) } as never)
}
function list_sources(key = write_key) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/sources', { method: 'GET', headers: { Authorization: `Bearer ${key}` } })
  return GET({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' } } as never)
}
function delete_source(source_id: string, query = '') {
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/sources/${source_id}${query}`, { method: 'DELETE', headers: { Authorization: `Bearer ${write_key}` } })
  return DELETE({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', sourceId: source_id }, url: new URL(request.url) } as never)
}

describe(POST, () => {
  test('creates a source; read key lists it with usage counts', async () => {
    const res = await post_source({ slug: 'smith1999', citation: 'Smith 1999', type: 'dictionary' })
    expect(res.status).toBe(200)
    const listed = await (await list_sources(read_key)).json()
    expect(listed.sources).toHaveLength(1)
    expect(listed.sources[0]).toMatchObject({ slug: 'smith1999', used_by: { entries: 0, sentences: 0, texts: 0 } })
  })

  test('400 on a duplicate slug', async () => {
    await post_source({ slug: 'dup' })
    await expect(post_source({ slug: 'dup' })).rejects.toMatchObject({ status: 400 })
  })

  test('400 on an invalid type', async () => {
    await expect(post_source({ slug: 's', type: 'bogus' })).rejects.toMatchObject({ status: 400 })
  })

  test('403 when a read key attempts to create', async () => {
    await expect(post_source({ slug: 'x' }, read_key)).rejects.toMatchObject({ status: 403 })
  })
})

describe(DELETE, () => {
  test('409 while referenced; remove_from_all strips refs (no JSON corruption) then deletes', async () => {
    await post_source({ slug: 'smith1999' })
    apply_entry_writes({ db: dict_db, history_db, user_id: 'edt-1', entries: [{ lexeme: 'mbwa', sources: ['smith1999'], notes: { en: 'keep me' } }] })
    const source_id = (dict_db.prepare(`SELECT id FROM sources WHERE slug = 'smith1999'`).get() as { id: string }).id

    await expect(delete_source(source_id)).rejects.toMatchObject({ status: 409 })

    const res = await delete_source(source_id, '?remove_from_all=true')
    expect((await res.json()).result).toBe('deleted')

    // The entry survives with its source stripped AND its other JSON columns intact
    // (regression guard for the double-encoding bug in remove_source_from_all).
    const entry = dict_db.prepare(`SELECT lexeme, notes, sources FROM entries LIMIT 1`).get() as { lexeme: string, notes: string, sources: string | null }
    expect(JSON.parse(entry.lexeme)).toEqual({ default: 'mbwa' })
    expect(JSON.parse(entry.notes)).toEqual({ en: 'keep me' })
    expect(entry.sources).toBeNull()
  })
})
