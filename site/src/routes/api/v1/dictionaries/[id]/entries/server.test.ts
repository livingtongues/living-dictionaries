import type Database from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { sign_jwt } from '$lib/auth/jwt'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { open_shared_db } from '$lib/db/server/shared-db'
import { GET, POST } from './+server'

let shared_db: ReturnType<typeof open_shared_db>
let dict_db: Database.Database
let history_db: Database.Database
let api_token: string

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))
vi.mock('$lib/db/server/dictionary-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-db')>()), get_dictionary_db: () => dict_db }))
vi.mock('$lib/db/server/dictionary-history-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-history-db')>()), get_dictionary_history_db: () => history_db }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  shared_db = open_shared_db(':memory:')
  dict_db = open_dictionary_db_in_memory('dict-1')
  history_db = open_dictionary_history_db_in_memory()

  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('edt-1', 'edt@x.com', 'Edt', JSON.stringify([{ provider: 'email', provider_id: 'edt@x.com' }]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  for (const id of ['dict-1', 'dict-2']) {
    shared_db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
      .run(id, id, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  }
  shared_db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('r-edt', 'dict-1', 'edt-1', 'editor', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')

  api_token = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'agent', role: 'write', created_by_user_id: 'edt-1' }).token
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
  history_db.close()
})

function call({ token, api_key, body }: { token?: string, api_key?: string, body: unknown }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/entries', { method: 'POST', body: JSON.stringify(body), headers })
  const cookies = { get: (name: string) => (name === 'session' ? token : undefined) }
  return POST({ request, cookies, params: { id: 'dict-1' } } as never)
}

describe(POST, () => {
  test('401 with no credentials', async () => {
    await expect(call({ body: { lexeme: 'x' } })).rejects.toMatchObject({ status: 401 })
  })

  test('401 with an invalid API key', async () => {
    await expect(call({ api_key: 'ldk_bogus', body: { lexeme: 'x' } })).rejects.toMatchObject({ status: 401 })
  })

  test('403 when the API key is scoped to another dictionary', async () => {
    const other = create_api_key({ db: shared_db, dictionary_id: 'dict-2', label: 'k', created_by_user_id: 'edt-1' }).token
    await expect(call({ api_key: other, body: { lexeme: 'x' } })).rejects.toMatchObject({ status: 403 })
  })

  test('403 when a read-only API key attempts a write', async () => {
    const read_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'ro', role: 'read', created_by_user_id: 'edt-1' }).token
    await expect(call({ api_key: read_key, body: { entries: [{ lexeme: 'x', senses: [{ glosses: { en: 'y' } }] }] } })).rejects.toMatchObject({ status: 403 })
  })

  test('400 when no entries are provided', async () => {
    await expect(call({ api_key: api_token, body: { entries: [] } })).rejects.toMatchObject({ status: 400 })
  })

  test('API key happy path creates an entry and mirrors updated_at', async () => {
    const res = await call({ api_key: api_token, body: { entries: [{ lexeme: 'mbwa', senses: [{ glosses: { en: 'dog' } }] }] } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({ created: 1, skipped: 0, failed: 0 })
    expect(data.results[0]).toMatchObject({ status: 'created' })

    const entry = dict_db.prepare(`SELECT * FROM entries WHERE id = ?`).get(data.results[0].entry_id) as Record<string, string>
    expect(JSON.parse(entry.lexeme)).toEqual({ default: 'mbwa' })
    expect(entry.updated_by_user_id).toBe('edt-1') // attributed to the key's creator

    const mirrored = shared_db.prepare(`SELECT updated_at FROM dictionaries WHERE id = 'dict-1'`).get() as { updated_at: string }
    expect(mirrored.updated_at).not.toBe('2026-01-01T00:00:00Z')
  })

  test('session JWT path also works for an editor', async () => {
    const token = await sign_jwt({ sub: 'edt-1', email: 'edt@x.com', name: 'Edt' })
    const res = await call({ token, body: { lexeme: 'solo-entry' } })
    expect(res.status).toBe(200)
    expect((await res.json()).created).toBe(1)
  })

  test('per-item failures are reported without aborting the batch', async () => {
    const res = await call({ api_key: api_token, body: { entries: [{ lexeme: 'ok' }, { lexeme: '' }] } })
    const data = await res.json()
    expect(data).toMatchObject({ created: 1, failed: 1 })
    expect(data.results[1].status).toBe('failed')
  })

  test('client-supplied id is used and a re-POST is an idempotent no-op', async () => {
    const id = crypto.randomUUID()
    const first = await (await call({ api_key: api_token, body: { entries: [{ id, lexeme: 'mbwa' }] } })).json()
    expect(first).toMatchObject({ created: 1, skipped: 0 })
    expect(first.results[0].entry_id).toBe(id)

    const again = await (await call({ api_key: api_token, body: { entries: [{ id, lexeme: 'CHANGED' }] } })).json()
    expect(again).toMatchObject({ created: 0, skipped: 1 })
    expect(again.results[0]).toMatchObject({ status: 'exists', entry_id: id })

    // The existing row was NOT clobbered (skip, not upsert).
    const row = dict_db.prepare(`SELECT lexeme FROM entries WHERE id = ?`).get(id) as { lexeme: string }
    expect(JSON.parse(row.lexeme)).toEqual({ default: 'mbwa' })
  })

  test('rejects a malformed client id as a failed item', async () => {
    const data = await (await call({ api_key: api_token, body: { entries: [{ id: 'not-a-uuid', lexeme: 'x' }] } })).json()
    expect(data).toMatchObject({ created: 0, failed: 1 })
    expect(data.results[0].error).toMatch(/uuid/i)
  })
})

function get_call({ api_key, query }: { api_key?: string, query?: string }) {
  const headers: Record<string, string> = {}
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/entries${query ?? ''}`, { method: 'GET', headers })
  const cookies = { get: () => undefined }
  return GET({ request, cookies, params: { id: 'dict-1' }, url: new URL(request.url) } as never)
}

describe(GET, () => {
  test('401 without a credential', async () => {
    await expect(get_call({})).rejects.toMatchObject({ status: 401 })
  })

  test('lists entries and filters by elicitation_id', async () => {
    await call({ api_key: api_token, body: { entries: [
      { lexeme: 'alpha', elicitation_id: 'A1' },
      { lexeme: 'beta', elicitation_id: 'B2' },
    ] } })

    const all = await (await get_call({ api_key: api_token })).json()
    expect(all.entries).toHaveLength(2)
    expect(all.has_more).toBeFalsy()
    expect(JSON.parse(JSON.stringify(all.entries[0].lexeme))).toBeTruthy()

    const filtered = await (await get_call({ api_key: api_token, query: '?elicitation_id=B2' })).json()
    expect(filtered.entries).toHaveLength(1)
    expect(filtered.entries[0].elicitation_id).toBe('B2')
  })

  test('filters by lexeme substring (default) and exact match', async () => {
    await call({ api_key: api_token, body: { entries: [
      { lexeme: 'mbwa' },
      { lexeme: 'mbwana' },
    ] } })

    const substring = await (await get_call({ api_key: api_token, query: '?lexeme=mbwa' })).json()
    expect(substring.entries).toHaveLength(2)

    const exact = await (await get_call({ api_key: api_token, query: '?lexeme=mbwa&match=exact' })).json()
    expect(exact.entries).toHaveLength(1)
    expect(JSON.parse(JSON.stringify(exact.entries[0].lexeme))).toEqual({ default: 'mbwa' })

    const exact_miss = await (await get_call({ api_key: api_token, query: '?lexeme=mbw&match=exact' })).json()
    expect(exact_miss.entries).toHaveLength(0)
  })

  test('paginates with limit/offset + has_more', async () => {
    await call({ api_key: api_token, body: { entries: [{ lexeme: 'a' }, { lexeme: 'b' }, { lexeme: 'c' }] } })
    const page = await (await get_call({ api_key: api_token, query: '?limit=2' })).json()
    expect(page.entries).toHaveLength(2)
    expect(page.has_more).toBeTruthy()
  })

  test('?include=senses attaches senses; omitted by default', async () => {
    await call({ api_key: api_token, body: { entries: [{ lexeme: 'mbwa', senses: [{ glosses: { en: 'dog' }, parts_of_speech: 'n' }] }] } })

    const plain = await (await get_call({ api_key: api_token })).json()
    expect(plain.entries[0].senses).toBeUndefined()

    const withSenses = await (await get_call({ api_key: api_token, query: '?include=senses' })).json()
    expect(withSenses.entries[0].senses).toHaveLength(1)
    expect(withSenses.entries[0].senses[0].glosses).toEqual({ en: 'dog' })
    expect(withSenses.entries[0].senses[0].parts_of_speech).toEqual(['n'])
  })

  test('a read-only key can read the list', async () => {
    const read_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'ro', role: 'read', created_by_user_id: 'edt-1' }).token
    await call({ api_key: api_token, body: { entries: [{ lexeme: 'readable' }] } })
    const res = await get_call({ api_key: read_key })
    expect(res.status).toBe(200)
    expect((await res.json()).entries).toHaveLength(1)
  })
})
