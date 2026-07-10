import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { apply_entry_writes } from '$lib/db/server/v1-entry-write'
import { DELETE } from './+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let dict_db: Database.Database
let history_db: Database.Database
let api_token: string
let entry_id: string

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
  const report = apply_entry_writes({ db: dict_db, user_id: 'u1', entries: [{ lexeme: 'mbwa', senses: [{ glosses: { en: 'dog' } }, { glosses: { en: 'hound' } }] }] })
  entry_id = report.results[0].entry_id as string
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
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/senses/${id}`, { method: 'DELETE', headers })
  return DELETE({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', senseId: id } } as never)
}

function sense_ids(): string[] {
  return (dict_db.prepare(`SELECT id FROM senses WHERE entry_id = ? ORDER BY created_at`).all(entry_id) as { id: string }[]).map(row => row.id)
}

describe(DELETE, () => {
  test('401 without a credential', async () => {
    await expect(delete_call({ id: sense_ids()[0] })).rejects.toMatchObject({ status: 401 })
  })

  test('404 for an unknown sense', async () => {
    await expect(delete_call({ api_key: api_token, id: 'nope' })).rejects.toMatchObject({ status: 404 })
  })

  test('deletes one of several senses', async () => {
    const [first] = sense_ids()
    const res = await delete_call({ api_key: api_token, id: first })
    expect((await res.json()).result).toBe('deleted')
    expect(sense_ids()).toHaveLength(1)
  })

  test('400 when deleting the only remaining sense', async () => {
    const [first] = sense_ids()
    await delete_call({ api_key: api_token, id: first })
    const [last] = sense_ids()
    await expect(delete_call({ api_key: api_token, id: last })).rejects.toMatchObject({ status: 400 })
  })
})
