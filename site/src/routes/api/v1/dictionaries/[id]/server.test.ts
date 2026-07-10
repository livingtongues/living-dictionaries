import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { GET } from './+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let api_token: string

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))

beforeEach(() => {
  shared_db = open_test_shared_db()
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u1', 'u@x.com', 'U', JSON.stringify([{ provider: 'email', provider_id: 'u@x.com' }]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  shared_db.prepare(`INSERT INTO dictionaries (id, url, name, gloss_languages, entry_count, public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('dict-1', 'mydict', 'My Dictionary', JSON.stringify(['en', 'sw']), 42, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  api_token = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'k', created_by_user_id: 'u1' }).token
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
