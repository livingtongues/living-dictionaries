import type Database from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { open_shared_db } from '$lib/db/server/shared-db'
import { GET as GET_LIST, POST } from './+server'
import { DELETE, GET as GET_ONE, PATCH } from './[textId]/+server'

let shared_db: ReturnType<typeof open_shared_db>
let dict_db: Database.Database
let history_db: Database.Database
let write_key: string
let read_key: string

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
  shared_db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run('dict-1', 'dict-1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  write_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'w', role: 'write', created_by_user_id: 'edt-1' }).token
  read_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'r', role: 'read', created_by_user_id: 'edt-1' }).token
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
  history_db.close()
})

function post_text(body: unknown, key = write_key) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/texts', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${key}` } })
  return POST({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' }, url: new URL(request.url) } as never)
}
function list_texts(key = write_key) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/texts', { method: 'GET', headers: { Authorization: `Bearer ${key}` } })
  return GET_LIST({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' } } as never)
}
function get_text(text_id: string, key = write_key) {
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/texts/${text_id}`, { method: 'GET', headers: { Authorization: `Bearer ${key}` } })
  return GET_ONE({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', textId: text_id } } as never)
}
function patch_text(text_id: string, body: unknown, key = write_key) {
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/texts/${text_id}`, { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${key}` } })
  return PATCH({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', textId: text_id } } as never)
}
function delete_text(text_id: string, key = write_key) {
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/texts/${text_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } })
  return DELETE({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', textId: text_id } } as never)
}

describe(POST, () => {
  test('creates a text with ordered sentences', async () => {
    const res = await post_text({ title: 'A Story', sentences: [
      { text: 'First.', translation: { en: 'First.' } },
      { text: 'Second.', ends_paragraph: true },
      { text: 'Third.' },
    ] })
    expect(res.status).toBe(200)
    const { text, created } = await res.json()
    expect(created).toBeTruthy()
    expect(text.title).toEqual({ default: 'A Story' })
    expect(text.sentences).toHaveLength(3)
    // Ordered by sort_key ascending → input order preserved.
    expect(text.sentences.map((s: { text: Record<string, string> }) => s.text.default)).toEqual(['First.', 'Second.', 'Third.'])
    const sort_keys = text.sentences.map((s: { sort_key: string }) => s.sort_key)
    expect(sort_keys).toEqual([...sort_keys].sort())
    expect(text.sentences[1].ends_paragraph).toBe(1)
  })

  test('client-supplied id makes re-POST a no-op', async () => {
    const id = crypto.randomUUID()
    const first = await (await post_text({ id, title: 'One' })).json()
    expect(first.created).toBeTruthy()
    const again = await (await post_text({ id, title: 'CHANGED' })).json()
    expect(again.created).toBeFalsy()
    expect(again.text.title).toEqual({ default: 'One' })
  })

  test('400 without a title', async () => {
    await expect(post_text({ sentences: [{ text: 'x' }] })).rejects.toMatchObject({ status: 400 })
  })

  test('403 when a read key attempts to create', async () => {
    await expect(post_text({ title: 'x' }, read_key)).rejects.toMatchObject({ status: 403 })
  })
})

describe(GET_ONE, () => {
  test('read key can read a text; append + reorder via PATCH', async () => {
    const { text } = await (await post_text({ title: 'T', sentences: [{ text: 'one' }, { text: 'two' }] })).json()

    const listed = await (await list_texts(read_key)).json()
    expect(listed.texts[0].sentence_count).toBe(2)

    // Append a sentence.
    await patch_text(text.id, { append_sentences: [{ text: 'three' }] })
    let full = await (await get_text(text.id, read_key)).json()
    expect(full.text.sentences.map((s: { text: Record<string, string> }) => s.text.default)).toEqual(['one', 'two', 'three'])

    // Reorder.
    const ids = full.text.sentences.map((s: { id: string }) => s.id)
    await patch_text(text.id, { sentence_order: [ids[2], ids[0], ids[1]] })
    full = await (await get_text(text.id)).json()
    expect(full.text.sentences.map((s: { text: Record<string, string> }) => s.text.default)).toEqual(['three', 'one', 'two'])
  })

  test('DELETE removes the text and its sentences', async () => {
    const { text } = await (await post_text({ title: 'gone', sentences: [{ text: 'a' }, { text: 'b' }] })).json()
    const res = await delete_text(text.id)
    expect((await res.json()).result).toBe('deleted')
    await expect(get_text(text.id)).rejects.toMatchObject({ status: 404 })
    const remaining = dict_db.prepare(`SELECT COUNT(*) AS c FROM sentences WHERE text_id = ?`).get(text.id) as { c: number }
    expect(remaining.c).toBe(0)
  })

  test('404 for an unknown text', async () => {
    await expect(get_text(crypto.randomUUID())).rejects.toMatchObject({ status: 404 })
  })
})
