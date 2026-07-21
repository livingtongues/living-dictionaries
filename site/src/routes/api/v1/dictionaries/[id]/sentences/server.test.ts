import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { POST } from './+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let dict_db: Database.Database
let history_db: Database.Database
let write_key: string
let read_key: string

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))
vi.mock('$lib/db/server/dictionary-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-db')>()), get_dictionary_db: () => dict_db }))
vi.mock('$lib/db/server/dictionary-history-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-history-db')>()), get_dictionary_history_db: () => history_db }))

beforeEach(() => {
  shared_db = open_test_shared_db()
  dict_db = open_dictionary_db_in_memory('dict-1')
  history_db = open_dictionary_history_db_in_memory()
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u1', 'u@x.com', 'U', JSON.stringify([{ provider: 'email', provider_id: 'u@x.com' }]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  shared_db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run('dict-1', 'D', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  write_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'write', role: 'write', created_by_user_id: 'u1' }).token
  read_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'read', role: 'read', created_by_user_id: 'u1' }).token
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
  history_db.close()
})

function post_sentence({ body, key }: { body: unknown, key?: string }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (key)
    headers.Authorization = `Bearer ${key}`
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/sentences', { method: 'POST', headers, body: JSON.stringify(body) })
  return POST({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' } } as never)
}

describe(POST, () => {
  test('401 without a credential', async () => {
    await expect(post_sentence({ body: { text: 'x' } })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for a read key', async () => {
    await expect(post_sentence({ body: { text: 'x' }, key: read_key })).rejects.toMatchObject({ status: 403 })
  })

  test('400 for an empty sentence', async () => {
    await expect(post_sentence({ body: {}, key: write_key })).rejects.toMatchObject({ status: 400, body: { message: 'sentence content is required' } })
  })

  test('creates a standalone sentence and client ids are idempotent', async () => {
    const id = crypto.randomUUID()
    const first = await (await post_sentence({ body: { id, text: 'A sentence', translation: { en: 'A translation' }, example_label: '(1)' }, key: write_key })).json()
    const again = await (await post_sentence({ body: { id, text: 'Changed' }, key: write_key })).json()

    expect(first).toMatchObject({ created: true, sentence: { id, text: { default: 'A sentence' }, translation: { en: 'A translation' }, text_id: null, sort_key: null, example_label: '(1)' } })
    expect(again).toMatchObject({ created: false, sentence: { id, text: { default: 'A sentence' } } })
    expect((dict_db.prepare(`SELECT COUNT(*) AS count FROM sentences`).get() as { count: number }).count).toBe(1)
  })
})
