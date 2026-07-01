import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { open_shared_db } from '$lib/db/server/shared-db'
import { apply_relationship_create } from '$lib/db/server/v1-relationship-write'
import { apply_entry_writes } from '$lib/db/server/v1-entry-write'
import { DELETE } from './+server'

let shared_db: ReturnType<typeof open_shared_db>
let dict_db: Database.Database
let history_db: Database.Database
let api_token: string
let relationship_id: string

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))
vi.mock('$lib/db/server/dictionary-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-db')>()), get_dictionary_db: () => dict_db }))
vi.mock('$lib/db/server/dictionary-history-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-history-db')>()), get_dictionary_history_db: () => history_db }))

beforeEach(() => {
  shared_db = open_shared_db(':memory:')
  dict_db = open_dictionary_db_in_memory('dict-1')
  history_db = open_dictionary_history_db_in_memory()
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u1', 'u@x.com', 'U', JSON.stringify([{ provider: 'email', provider_id: 'u@x.com' }]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  shared_db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run('dict-1', 'D', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  api_token = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'k', created_by_user_id: 'u1' }).token
  const report = apply_entry_writes({ db: dict_db, user_id: 'u1', entries: [{ lexeme: 'dog' }, { lexeme: 'perro' }] })
  const dog_id = report.results[0].entry_id as string
  const perro_id = report.results[1].entry_id as string
  relationship_id = apply_relationship_create({ db: dict_db, input: { from_entry_id: dog_id, to_entry_id: perro_id, type: 'cognate' }, user_id: 'u1' }).relationship.id
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
  history_db.close()
})

function delete_call({ api_key, id }: { api_key?: string, id: string }) {
  const headers: Record<string, string> = {}
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/relationships/${id}`, { method: 'DELETE', headers })
  return DELETE({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', relationshipId: id } } as never)
}

describe(DELETE, () => {
  test('401 without a credential', async () => {
    await expect(delete_call({ id: relationship_id })).rejects.toMatchObject({ status: 401 })
  })

  test('404 for an unknown id', async () => {
    await expect(delete_call({ api_key: api_token, id: 'nope' })).rejects.toMatchObject({ status: 404 })
  })

  test('deletes the relationship', async () => {
    const res = await delete_call({ api_key: api_token, id: relationship_id })
    expect((await res.json()).result).toBe('deleted')
    expect((dict_db.prepare(`SELECT COUNT(*) c FROM entry_relationships`).get() as { c: number }).c).toBe(0)
  })
})
