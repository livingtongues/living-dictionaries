import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { GET, PATCH } from './+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let api_token: string
let read_token: string

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))

beforeEach(() => {
  shared_db = open_test_shared_db()
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u1', 'u@x.com', 'U', JSON.stringify([{ provider: 'email', provider_id: 'u@x.com' }]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  shared_db.prepare(`INSERT INTO dictionaries (id, url, name, gloss_languages, entry_count, public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('dict-1', 'mydict', 'My Dictionary', JSON.stringify(['en', 'sw']), 42, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  api_token = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'k', created_by_user_id: 'u1' }).token
  read_token = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'r', role: 'read', created_by_user_id: 'u1' }).token
})

afterEach(() => shared_db.close())

function get_call({ api_key, id = 'dict-1' }: { api_key?: string, id?: string }) {
  const headers: Record<string, string> = {}
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const request = new Request(`http://localhost/api/v1/dictionaries/${id}`, { method: 'GET', headers })
  return GET({ request, cookies: { get: () => undefined }, params: { id } } as never)
}

describe(GET, () => {
  test('401 without a credential', async () => {
    await expect(get_call({})).rejects.toMatchObject({ status: 401 })
  })

  test('resolves by url-slug and returns gloss_languages + meta', async () => {
    const res = await get_call({ api_key: api_token, id: 'mydict' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({ id: 'dict-1', name: 'My Dictionary', gloss_languages: ['en', 'sw'], entry_count: 42, public: true })
  })
})

function patch_call({ api_key, body, id = 'dict-1' }: { api_key?: string, body: unknown, id?: string }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const request = new Request(`http://localhost/api/v1/dictionaries/${id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
  return PATCH({ request, cookies: { get: () => undefined }, params: { id } } as never)
}

describe(PATCH, () => {
  test('401 without a credential', async () => {
    await expect(patch_call({ body: { about: 'hi' } })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for a read-scope key', async () => {
    await expect(patch_call({ api_key: read_token, body: { about: 'hi' } })).rejects.toMatchObject({ status: 403 })
  })

  test('writes about + citation and returns the updated row', async () => {
    const res = await patch_call({ api_key: api_token, body: { about: '## About\n\nSome prose.', citation: 'Cite me 2019' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'dict-1', name: 'My Dictionary' })
    const row = shared_db.prepare(`SELECT about, citation, updated_by_user_id FROM dictionaries WHERE id = 'dict-1'`).get() as Record<string, string>
    expect(row.about).toBe('## About\n\nSome prose.')
    expect(row.citation).toBe('Cite me 2019')
    expect(row.updated_by_user_id).toBe('u1')
  })

  test('JSON columns are stringified, not stored as [object Object]', async () => {
    await patch_call({ api_key: api_token, body: { alternate_names: ['Ponka', 'Páⁿka'] } })
    const row = shared_db.prepare(`SELECT alternate_names FROM dictionaries WHERE id = 'dict-1'`).get() as Record<string, string>
    expect(JSON.parse(row.alternate_names)).toEqual(['Ponka', 'Páⁿka'])
  })

  test('400 on an unknown field', async () => {
    await expect(patch_call({ api_key: api_token, body: { nope: 1 } })).rejects.toMatchObject({ status: 400 })
  })

  test('400 on a field that has its own endpoint, naming the better door', async () => {
    for (const field of ['gloss_languages', 'orthographies', 'featured_image', 'public'])
      await expect(patch_call({ api_key: api_token, body: { [field]: null } })).rejects.toMatchObject({ status: 400, body: { message: expect.stringContaining('not updatable here') } })
  })

  test('400 on an empty body', async () => {
    await expect(patch_call({ api_key: api_token, body: {} })).rejects.toMatchObject({ status: 400 })
  })

  test('does NOT set the client-only dirty flag', async () => {
    await patch_call({ api_key: api_token, body: { about: 'x' } })
    const row = shared_db.prepare(`SELECT dirty FROM dictionaries WHERE id = 'dict-1'`).get() as Record<string, unknown>
    expect(row.dirty).toBe(null)
  })
})
