import type Database from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { GET, POST, PUT } from './+server'
import { DELETE, PATCH } from './[code]/+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let dict_db: Database.Database
let write_key: string
let read_key: string

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))
vi.mock('$lib/db/server/dictionary-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-db')>()), get_dictionary_db: () => dict_db }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  shared_db = open_test_shared_db()
  dict_db = open_dictionary_db_in_memory('dict-1')
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('edt-1', 'edt@x.com', 'Edt', JSON.stringify([]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  shared_db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run('dict-1', 'dict-1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  write_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'w', role: 'write', created_by_user_id: 'edt-1' }).token
  read_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'r', role: 'read', created_by_user_id: 'edt-1' }).token
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
})

function insert_entry(lexeme: Record<string, string>) {
  dict_db.prepare(`INSERT INTO entries (id, lexeme, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(crypto.randomUUID(), JSON.stringify(lexeme), 'edt-1', '2026-01-01T00:00:00Z', 'edt-1', '2026-01-01T00:00:00Z')
}
function read_stored_orthographies() {
  const row = shared_db.prepare('SELECT orthographies FROM dictionaries WHERE id = ?').get('dict-1') as { orthographies: string | null }
  return row.orthographies ? JSON.parse(row.orthographies) : null
}

const base = { cookies: { get: () => undefined }, params: { id: 'dict-1' } }
function post(body: unknown, key = write_key) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/orthographies', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${key}` } })
  return POST({ ...base, request, url: new URL(request.url) } as never)
}
function list(key = write_key) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/orthographies', { method: 'GET', headers: { Authorization: `Bearer ${key}` } })
  return GET({ ...base, request } as never)
}
function patch(code: string, body: unknown) {
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/orthographies/${code}`, { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${write_key}` } })
  return PATCH({ ...base, request, params: { id: 'dict-1', code } } as never)
}
function del(code: string) {
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/orthographies/${code}`, { method: 'DELETE', headers: { Authorization: `Bearer ${write_key}` } })
  return DELETE({ ...base, request, params: { id: 'dict-1', code } } as never)
}
function reorder(order: string[]) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/orthographies', { method: 'PUT', body: JSON.stringify({ order }), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${write_key}` } })
  return PUT({ ...base, request, url: new URL(request.url) } as never)
}

describe(POST, () => {
  test('creates a custom alternate; read key lists it with zero usage', async () => {
    const res = await post({ code: 'village-spelling', name: 'Village' })
    expect(res.status).toBe(200)
    expect((await res.json()).orthography).toEqual({ code: 'village-spelling', name: 'Village' })
    const listed = await (await list(read_key)).json()
    expect(listed.orthographies).toEqual([{ code: 'village-spelling', name: 'Village', used_by: { entries: 0, sentences: 0 } }])
  })

  test('a known writing-system tag auto-wires its bcp', async () => {
    const { orthography } = await (await post({ code: 'srb-sora', name: 'Sompeng' })).json()
    expect(orthography).toEqual({ code: 'srb-sora', name: 'Sompeng', bcp: 'srb-sora' })
  })

  test('rejects reserved codes, duplicates, and bad format', async () => {
    await expect(post({ code: 'default' })).rejects.toMatchObject({ status: 400 })
    await expect(post({ code: 'lo1' })).rejects.toMatchObject({ status: 400 })
    await expect(post({ code: 'bad code!' })).rejects.toMatchObject({ status: 400 })
    await post({ code: 'latin' })
    await expect(post({ code: 'Latin' })).rejects.toMatchObject({ status: 400 }) // case-insensitive dup
  })

  test('read key cannot create', async () => {
    await expect(post({ code: 'x-latn' }, read_key)).rejects.toMatchObject({ status: 403 })
  })
})

describe(PATCH, () => {
  test('renames an alternate without changing its code, preserving bcp', async () => {
    await post({ code: 'srb-sora', name: 'Sompeng' })
    const { orthography } = await (await patch('srb-sora', { name: 'Sompeng (new)' })).json()
    expect(orthography).toEqual({ code: 'srb-sora', name: 'Sompeng (new)', bcp: 'srb-sora' })
  })

  test('labeling the primary materializes a default-coded entry', async () => {
    const { orthography } = await (await patch('default', { name: 'Latin', bcp: 'sat-Latn' })).json()
    expect(orthography).toEqual({ code: 'default', name: 'Latin', bcp: 'sat-Latn', primary: true })
    expect(read_stored_orthographies()).toEqual([{ code: 'default', name: 'Latin', bcp: 'sat-Latn', primary: true }])
  })
})

describe(DELETE, () => {
  test('refuses to delete an orthography in use, allows once cleared', async () => {
    await post({ code: 'sat-Olck', name: 'Ol Chiki' })
    insert_entry({ 'default': 'hi', 'sat-Olck': 'ᱦᱤ' })
    await expect(del('sat-Olck')).rejects.toMatchObject({ status: 400 })

    dict_db.prepare('DELETE FROM entries').run() // clear all usage
    expect((await del('sat-Olck')).status).toBe(200)
    expect(read_stored_orthographies()).toEqual([])
  })

  test('refuses to delete the primary', async () => {
    await expect(del('default')).rejects.toMatchObject({ status: 400 })
  })
})

describe(PUT, () => {
  test('reorders the alternates', async () => {
    await post({ code: 'a-latn', name: 'A' })
    await post({ code: 'b-latn', name: 'B' })
    const { orthographies } = await (await reorder(['b-latn', 'a-latn'])).json()
    expect(orthographies.map((orthography: { code: string }) => orthography.code)).toEqual(['b-latn', 'a-latn'])
  })

  test('rejects an order missing a code', async () => {
    await post({ code: 'a-latn', name: 'A' })
    await post({ code: 'b-latn', name: 'B' })
    await expect(reorder(['a-latn'])).rejects.toMatchObject({ status: 400 })
  })
})
