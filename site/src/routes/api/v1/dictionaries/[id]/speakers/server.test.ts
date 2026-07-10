import type Database from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { GET, POST } from './+server'

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

function post_speaker(body: unknown, key = write_key) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/speakers', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${key}` } })
  return POST({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' }, url: new URL(request.url) } as never)
}
function list_speakers(key = write_key) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/speakers', { method: 'GET', headers: { Authorization: `Bearer ${key}` } })
  return GET({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' } } as never)
}

describe(POST, () => {
  test('creates a speaker; read key can list', async () => {
    const res = await post_speaker({ name: 'Ana', decade: 1980, gender: 'f', birthplace: 'Nairobi' })
    expect(res.status).toBe(200)
    expect((await res.json()).speaker).toMatchObject({ name: 'Ana', decade: 1980, gender: 'f' })
    const listed = await (await list_speakers(read_key)).json()
    expect(listed.speakers).toHaveLength(1)
  })

  test('400 on a missing name', async () => {
    await expect(post_speaker({ decade: 1980 })).rejects.toMatchObject({ status: 400 })
  })

  test('400 on an invalid gender', async () => {
    await expect(post_speaker({ name: 'x', gender: 'male' })).rejects.toMatchObject({ status: 400 })
  })

  test('400 on a non-integer decade', async () => {
    await expect(post_speaker({ name: 'x', decade: 'the 80s' })).rejects.toMatchObject({ status: 400 })
  })

  test('403 when a read key attempts to create', async () => {
    await expect(post_speaker({ name: 'x' }, read_key)).rejects.toMatchObject({ status: 403 })
  })
})
