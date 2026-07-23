import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { apply_entry_writes } from '$lib/db/server/v1-entry-write'
import { GET, POST } from './+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let dict_db: Database.Database
let history_db: Database.Database
let api_token: string
let dog_id: string
let perro_id: string

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
  api_token = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'k', created_by_user_id: 'u1' }).token
  const report = apply_entry_writes({ db: dict_db, user_id: 'u1', entries: [
    { lexeme: 'dog', senses: [{ glosses: { en: 'dog' } }] },
    { lexeme: 'perro', senses: [{ glosses: { es: 'perro' } }] },
  ] })
  dog_id = report.results[0].entry_id as string
  perro_id = report.results[1].entry_id as string
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
  history_db.close()
})

function post_call({ api_key, body }: { api_key?: string, body: unknown }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/relationships`, { method: 'POST', headers, body: JSON.stringify(body) })
  return POST({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' } } as never)
}

function get_call({ api_key, entry_id }: { api_key?: string, entry_id?: string }) {
  const headers: Record<string, string> = {}
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const url = `http://localhost/api/v1/dictionaries/dict-1/relationships${entry_id ? `?entry_id=${entry_id}` : ''}`
  return GET({ request: new Request(url, { headers }), cookies: { get: () => undefined }, params: { id: 'dict-1' }, url: new URL(url) } as never)
}

describe(POST, () => {
  test('401 without a credential', async () => {
    await expect(post_call({ body: { from_entry_id: 'dog', to_entry_id: 'perro', type: 'cognate' } })).rejects.toMatchObject({ status: 401 })
  })

  test('400 when type + custom_type are both missing', async () => {
    await expect(post_call({ api_key: api_token, body: { from_entry_id: dog_id, to_entry_id: perro_id } })).rejects.toMatchObject({ status: 400 })
  })

  test('400 on an unknown global type', async () => {
    await expect(post_call({ api_key: api_token, body: { from_entry_id: dog_id, to_entry_id: perro_id, type: 'nonsense' } })).rejects.toMatchObject({ status: 400 })
  })

  test('creates a relationship and persists the row', async () => {
    const res = await post_call({ api_key: api_token, body: { from_entry_id: dog_id, to_entry_id: perro_id, type: 'cognate' } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.created).toBeTruthy()
    expect(data.relationship.type).toBe('cognate')
    expect(data.relationship.related.entry_id).toBe(perro_id)
    expect((dict_db.prepare(`SELECT COUNT(*) c FROM entry_relationships`).get() as { c: number }).c).toBe(1)
  })

  test('is idempotent', async () => {
    await post_call({ api_key: api_token, body: { from_entry_id: dog_id, to_entry_id: perro_id, type: 'synonym' } })
    const res = await post_call({ api_key: api_token, body: { from_entry_id: dog_id, to_entry_id: perro_id, type: 'synonym' } })
    expect((await res.json()).created).toBeFalsy()
    expect((dict_db.prepare(`SELECT COUNT(*) c FROM entry_relationships`).get() as { c: number }).c).toBe(1)
  })

  test('batch body ({ relationships }) returns per-item results in order', async () => {
    const res = await post_call({ api_key: api_token, body: { relationships: [
      { from_entry_id: dog_id, to_entry_id: perro_id, type: 'cognate' },
      { from_entry_id: dog_id, to_entry_id: perro_id, type: 'cognate' },
      { from_entry_id: dog_id, to_entry_id: 'ghost', type: 'cognate' },
    ] } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.created).toBe(1)
    expect(data.existed).toBe(1)
    expect(data.failed).toBe(1)
    expect(data.results.map((r: { status: string }) => r.status)).toEqual(['created', 'exists', 'failed'])
    expect((dict_db.prepare(`SELECT COUNT(*) c FROM entry_relationships`).get() as { c: number }).c).toBe(1)
  })

  test('bare-array batch body works too', async () => {
    const res = await post_call({ api_key: api_token, body: [{ from_entry_id: dog_id, to_entry_id: perro_id, type: 'antonym' }] })
    const data = await res.json()
    expect(data.created).toBe(1)
    expect(data.results[0].relationship_id).toBeTruthy()
  })

  test('400 on an empty batch', async () => {
    await expect(post_call({ api_key: api_token, body: { relationships: [] } })).rejects.toMatchObject({ status: 400 })
  })

  test('400 when a batch exceeds the 1000-item cap', async () => {
    const relationships = Array.from({ length: 1001 }, () => ({ from_entry_id: dog_id, to_entry_id: perro_id, type: 'cognate' }))
    await expect(post_call({ api_key: api_token, body: { relationships } })).rejects.toMatchObject({ status: 400 })
  })
})

describe(GET, () => {
  test('400 without entry_id', async () => {
    await expect(get_call({ api_key: api_token })).rejects.toMatchObject({ status: 400 })
  })

  test('lists relationships for an entry from its viewpoint', async () => {
    await post_call({ api_key: api_token, body: { from_entry_id: dog_id, to_entry_id: perro_id, type: 'cognate' } })
    const res = await get_call({ api_key: api_token, entry_id: perro_id })
    const data = await res.json()
    expect(data.relationships).toHaveLength(1)
    // `related` is always the OTHER endpoint (symmetric types canonicalize
    // endpoint order, so `direction` here isn't meaningful — hence not asserted).
    expect(data.relationships[0].type).toBe('cognate')
    expect(data.relationships[0].related.entry_id).toBe(dog_id)
  })
})
