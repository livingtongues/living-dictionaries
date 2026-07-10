import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { apply_entry_writes } from '$lib/db/server/v1-entry-write'
import { DELETE, PATCH } from './+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let dict_db: Database.Database
let history_db: Database.Database
let api_token: string
let tag_id: string

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
  apply_entry_writes({ db: dict_db, user_id: 'u1', entries: [
    { lexeme: 'mbwa', tags: ['needs-reviw'], senses: [{ glosses: { en: 'dog' } }] },
    { lexeme: 'paka', tags: ['cat-set'], senses: [{ glosses: { en: 'cat' } }] },
  ] })
  tag_id = (dict_db.prepare(`SELECT id FROM tags WHERE name = ?`).get('needs-reviw') as { id: string }).id
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
  history_db.close()
})

function patch_call({ api_key, id, body }: { api_key?: string, id: string, body: unknown }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/tags/${id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
  return PATCH({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', tagId: id } } as never)
}

function delete_call({ api_key, id }: { api_key?: string, id: string }) {
  const headers: Record<string, string> = {}
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/tags/${id}`, { method: 'DELETE', headers })
  return DELETE({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', tagId: id } } as never)
}

describe(PATCH, () => {
  test('401 without a credential', async () => {
    await expect(patch_call({ id: tag_id, body: { name: 'x' } })).rejects.toMatchObject({ status: 401 })
  })

  test('404 for an unknown tag', async () => {
    await expect(patch_call({ api_key: api_token, id: 'nope', body: { name: 'x' } })).rejects.toMatchObject({ status: 404 })
  })

  test('renames the tag', async () => {
    const res = await patch_call({ api_key: api_token, id: tag_id, body: { name: 'needs-review' } })
    expect(res.status).toBe(200)
    expect((await res.json()).tag.name).toBe('needs-review')
    expect((dict_db.prepare(`SELECT name FROM tags WHERE id = ?`).get(tag_id) as { name: string }).name).toBe('needs-review')
  })

  test('400 when renaming to a name another tag already has', async () => {
    await expect(patch_call({ api_key: api_token, id: tag_id, body: { name: 'cat-set' } })).rejects.toMatchObject({ status: 400 })
  })
})

describe(DELETE, () => {
  test('deletes the tag globally and unlinks it from every entry', async () => {
    const res = await delete_call({ api_key: api_token, id: tag_id })
    expect((await res.json()).result).toBe('deleted')
    expect((dict_db.prepare(`SELECT COUNT(*) c FROM tags WHERE id = ?`).get(tag_id) as { c: number }).c).toBe(0)
    expect((dict_db.prepare(`SELECT COUNT(*) c FROM entry_tags WHERE tag_id = ?`).get(tag_id) as { c: number }).c).toBe(0)
  })

  test('404 for an unknown tag', async () => {
    await expect(delete_call({ api_key: api_token, id: 'nope' })).rejects.toMatchObject({ status: 404 })
  })
})
