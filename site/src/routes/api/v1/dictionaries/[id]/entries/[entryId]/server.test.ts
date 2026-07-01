import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { open_shared_db } from '$lib/db/server/shared-db'
import { apply_relationship_create } from '$lib/db/server/v1-relationship-write'
import { apply_entry_writes } from '$lib/db/server/v1-entry-write'
import { DELETE, GET, PATCH } from './+server'

let shared_db: ReturnType<typeof open_shared_db>
let dict_db: Database.Database
let history_db: Database.Database
let api_token: string
let entry_id: string
let sense_id: string

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
  const report = apply_entry_writes({ db: dict_db, user_id: 'u1', entries: [{ lexeme: 'mbwa', senses: [{ glosses: { en: 'dog' }, example_sentences: [{ text: 'Mbwa wangu', translation: { en: 'My dog' } }] }] }] })
  entry_id = report.results[0].entry_id as string
  sense_id = report.results[0].sense_ids?.[0] as string
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
  history_db.close()
})

function get_call({ api_key, id, include }: { api_key?: string, id: string, include?: string }) {
  const headers: Record<string, string> = {}
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const url = `http://localhost/api/v1/dictionaries/dict-1/entries/${id}${include ? `?include=${include}` : ''}`
  const request = new Request(url, { method: 'GET', headers })
  return GET({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', entryId: id }, url: new URL(url) } as never)
}

function patch_call({ api_key, id, body }: { api_key?: string, id: string, body: unknown }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/entries/${id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
  return PATCH({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', entryId: id } } as never)
}

function delete_call({ api_key, id }: { api_key?: string, id: string }) {
  const headers: Record<string, string> = {}
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/entries/${id}`, { method: 'DELETE', headers })
  return DELETE({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', entryId: id } } as never)
}

describe(GET, () => {
  test('401 without a credential', async () => {
    await expect(get_call({ id: entry_id })).rejects.toMatchObject({ status: 401 })
  })

  test('404 for an unknown entry', async () => {
    await expect(get_call({ api_key: api_token, id: 'nope' })).rejects.toMatchObject({ status: 404 })
  })

  test('returns the fully-assembled nested entry', async () => {
    const res = await get_call({ api_key: api_token, id: entry_id })
    expect(res.status).toBe(200)
    const { entry } = await res.json()
    expect(entry.main.lexeme).toEqual({ default: 'mbwa' })
    expect(entry.senses[0].glosses).toEqual({ en: 'dog' })
    expect(entry.senses[0].sentences[0].text).toEqual({ default: 'Mbwa wangu' })
    expect(entry.relationships).toBeUndefined()
  })

  test('include=relationships expands the entry with its relationships', async () => {
    const { results } = apply_entry_writes({ db: dict_db, user_id: 'u1', entries: [{ lexeme: 'perro' }] })
    const perro_id = results[0].entry_id as string
    apply_relationship_create({ db: dict_db, input: { from_entry_id: entry_id, to_entry_id: perro_id, type: 'cognate' }, user_id: 'u1' })

    const res = await get_call({ api_key: api_token, id: entry_id, include: 'relationships' })
    const { entry } = await res.json()
    expect(entry.relationships).toHaveLength(1)
    expect(entry.relationships[0].type).toBe('cognate')
    expect(entry.relationships[0].related.entry_id).toBe(perro_id)
  })
})

describe(PATCH, () => {
  test('401 without a credential', async () => {
    await expect(patch_call({ id: entry_id, body: { phonetic: 'x' } })).rejects.toMatchObject({ status: 401 })
  })

  test('404 for an unknown entry', async () => {
    await expect(patch_call({ api_key: api_token, id: 'nope', body: { phonetic: 'x' } })).rejects.toMatchObject({ status: 404 })
  })

  test('merges fields + sense gloss and returns the updated entry', async () => {
    const res = await patch_call({ api_key: api_token, id: entry_id, body: { phonetic: 'mˈbwa', senses: [{ id: sense_id, glosses: { en: 'hound' } }] } })
    expect(res.status).toBe(200)
    const { entry } = await res.json()
    expect(entry.main.phonetic).toBe('mˈbwa')
    expect(entry.main.lexeme).toEqual({ default: 'mbwa' })
    expect(entry.senses[0].glosses).toEqual({ en: 'hound' })
  })

  test('400 when a sense id is not on the entry', async () => {
    await expect(patch_call({ api_key: api_token, id: entry_id, body: { senses: [{ id: 'foreign', glosses: { en: 'x' } }] } }))
      .rejects.toMatchObject({ status: 400 })
  })
})

describe(DELETE, () => {
  test('401 without a credential', async () => {
    await expect(delete_call({ id: entry_id })).rejects.toMatchObject({ status: 401 })
  })

  test('404 for an unknown entry', async () => {
    await expect(delete_call({ api_key: api_token, id: 'nope' })).rejects.toMatchObject({ status: 404 })
  })

  test('deletes the entry', async () => {
    const res = await delete_call({ api_key: api_token, id: entry_id })
    expect((await res.json()).result).toBe('deleted')
    expect((dict_db.prepare(`SELECT COUNT(*) c FROM entries`).get() as { c: number }).c).toBe(0)
  })
})
