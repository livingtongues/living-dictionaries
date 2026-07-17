import type Database from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { merge_dict_row } from '$lib/db/server/dictionary-sync-helpers'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { GET } from './+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let dict_db: Database.Database
let read_key: string
const NOW = '2026-01-01T00:00:00.000Z'

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))
vi.mock('$lib/db/server/dictionary-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-db')>()), get_dictionary_db: () => dict_db }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  shared_db = open_test_shared_db()
  dict_db = open_dictionary_db_in_memory('dict-1')
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('edt-1', 'edt@x.com', 'Edt', JSON.stringify([]), NOW, NOW)
  shared_db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run('dict-1', 'dict-1', NOW, NOW)
  read_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'r', role: 'read', created_by_user_id: 'edt-1' }).token
  merge_dict_row({ db: dict_db, table_name: 'entries', row: { id: 'e1', lexeme: { default: 'mbwa' }, created_at: NOW, updated_at: NOW }, user_id: 'edt-1' })
  merge_dict_row({ db: dict_db, table_name: 'audio', row: { id: 'aud-1', entry_id: 'e1', storage_path: 'dict-1/audio/e1/rec.mp3', created_at: NOW, updated_at: NOW }, user_id: 'edt-1' })
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
})

function get_media(path: string, key?: string) {
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/media/${path}`, { method: 'GET', headers: key ? { Authorization: `Bearer ${key}` } : {} })
  return GET({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', path } } as never)
}

describe(GET, () => {
  test('302-redirects a known storage_path to the byte store (dev store under vitest)', async () => {
    await expect(get_media('dict-1/audio/e1/rec.mp3', read_key)).rejects.toMatchObject({
      status: 302,
      location: '/api/dev-media/dict-1/audio/e1/rec.mp3',
    })
  })

  test('404 for a storage_path no media row in this dictionary has', async () => {
    await expect(get_media('other-dict/audio/e9/rec.mp3', read_key)).rejects.toMatchObject({ status: 404 })
  })

  test('401 without a key', async () => {
    await expect(get_media('dict-1/audio/e1/rec.mp3')).rejects.toMatchObject({ status: 401 })
  })
})
