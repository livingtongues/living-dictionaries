import type Database from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { stringify_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { GET } from './+server'

let db: Database.Database

vi.mock('$lib/db/server/get-dictionary', () => ({
  get_dictionary_by_url_or_id: (url_or_id: string) =>
    url_or_id === 'missing-dict' ? null : { id: 'dict-1', url: 'dict-1' },
}))

vi.mock('$lib/db/server/dictionary-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/dictionary-db')>('$lib/db/server/dictionary-db')
  return { ...actual, get_dictionary_db: () => db }
})

const NOW = '2024-01-01T00:00:00Z'

function insert(table: string, row: Record<string, unknown>) {
  const full = stringify_dict_row(table, { dirty: 0, created_by_user_id: 'u1', created_at: NOW, updated_by_user_id: 'u1', updated_at: NOW, ...row })
  const columns = Object.keys(full)
  db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...columns.map(column => full[column]))
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_dictionary_db_in_memory('endpoint_test')
  insert('entries', { id: 'e1', lexeme: { default: 'jaʼ' } })
  insert('tags', { id: 't-pub', name: 'animals', private: 0 })
  insert('tags', { id: 't-priv', name: 'sensitive', private: 1 })
  insert('entry_tags', { id: 'et1', entry_id: 'e1', tag_id: 't-pub', created_at: '2024-01-01T00:00:01Z' })
  insert('entry_tags', { id: 'et2', entry_id: 'e1', tag_id: 't-priv', created_at: '2024-01-01T00:00:02Z' })
})

afterEach(() => {
  db.close()
})

function call(options: { token?: string, dict?: string, entry?: string }) {
  const dict = options.dict ?? 'dict-1'
  const entry = options.entry ?? 'e1'
  const request = new Request(`http://localhost/api/dictionary/${dict}/entry/${entry}`)
  const cookies = { get: (name: string) => (name === 'session' ? options.token : undefined) }
  return GET({ request, cookies, params: { id: dict, entryId: entry } } as unknown as Parameters<typeof GET>[0])
}

describe(GET, () => {
  test('404 for an unknown dictionary', async () => {
    await expect(call({ dict: 'missing-dict' })).rejects.toMatchObject({ status: 404 })
  })

  test('anonymous gets the entry with public tags only', async () => {
    const response = await call({})
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.entry.id).toBe('e1')
    expect(body.entry.main.lexeme).toEqual({ default: 'jaʼ' })
    expect(body.entry.tags.map((tag: { id: string }) => tag.id)).toEqual(['t-pub'])
  })

  test('admin session widens tag visibility to private tags', async () => {
    const token = await sign_jwt({ sub: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob' })
    const response = await call({ token })
    const body = await response.json()
    expect(body.entry.tags.map((tag: { id: string }) => tag.id).sort()).toEqual(['t-priv', 't-pub'])
  })

  test('returns { entry: null } for a missing entry id', async () => {
    const response = await call({ entry: 'does-not-exist' })
    expect(response.status).toBe(200)
    expect((await response.json()).entry).toBeNull()
  })
})
