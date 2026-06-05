import { beforeAll, describe, expect, test } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { POST } from './+server'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

function admin_token() {
  return sign_jwt({ sub: 'admin-id', email: 'jwrunner7@gmail.com', name: 'Jacob' })
}

function non_admin_token() {
  return sign_jwt({ sub: 'u1', email: 'alice@example.com', name: 'Alice' })
}

function call(options: { token?: string, body?: unknown } = {}) {
  const request = new Request('http://localhost/api/admin/schema-from-sql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options.body ?? {}),
  })
  const cookies = { get: (name: string) => (name === 'session' ? options.token : undefined) }
  return POST({ request, cookies } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ body: { sql: 'CREATE TABLE t (id TEXT PRIMARY KEY)' } })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for non-admin', async () => {
    const token = await non_admin_token()
    await expect(call({ token, body: { sql: 'CREATE TABLE t (id TEXT PRIMARY KEY)' } })).rejects.toMatchObject({ status: 403 })
  })

  test('400 when sql missing', async () => {
    const token = await admin_token()
    await expect(call({ token, body: {} })).rejects.toMatchObject({ status: 400 })
  })

  test('400 on invalid SQL', async () => {
    const token = await admin_token()
    await expect(call({ token, body: { sql: 'NOT VALID SQL;' } })).rejects.toMatchObject({ status: 400 })
  })

  test('200 introspects pasted schema with a custom label', async () => {
    const token = await admin_token()
    const sql = `
      CREATE TABLE authors (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE books (
        id TEXT PRIMARY KEY,
        author_id TEXT REFERENCES authors(id) ON DELETE CASCADE,
        title TEXT NOT NULL
      );
    `
    const response = await call({ token, body: { sql, label: 'house schema' } })
    const body = await response.json() as { schema: { source_label: string, tables: { name: string, foreign_keys: unknown[], row_count: number | null }[] } }
    expect(body.schema.source_label).toBe('house schema')
    const table_names = body.schema.tables.map(t => t.name)
    expect(table_names).toEqual(['authors', 'books'])
    const books = body.schema.tables.find(t => t.name === 'books')!
    expect(books.foreign_keys).toHaveLength(1)
    expect(books.row_count).toBeNull()
  })
})
