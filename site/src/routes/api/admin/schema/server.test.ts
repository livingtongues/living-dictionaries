import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { GET } from './+server'

let db: ReturnType<typeof open_test_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return {
    ...actual,
    get_shared_db: () => db,
  }
})

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_test_shared_db()
})

afterEach(() => {
  db.close()
})

function admin_token() {
  return sign_jwt({ sub: 'admin-id', email: 'jwrunner7@gmail.com', name: 'Jacob' })
}

function non_admin_token() {
  return sign_jwt({ sub: 'u1', email: 'alice@example.com', name: 'Alice' })
}

function call(options: { token?: string, source?: string } = {}) {
  const search = options.source ? `?source=${options.source}` : ''
  const request = new Request(`http://localhost/api/admin/schema${search}`, { method: 'GET' })
  const cookies = { get: (name: string) => (name === 'session' ? options.token : undefined) }
  return GET({ request, cookies, url: new URL(request.url) } as unknown as Parameters<typeof GET>[0])
}

describe(GET, () => {
  test('401 without auth', async () => {
    await expect(call()).rejects.toMatchObject({ status: 401 })
  })

  test('403 for non-admin', async () => {
    const token = await non_admin_token()
    await expect(call({ token })).rejects.toMatchObject({ status: 403 })
  })

  test('200 for admin — shared.db returns users + migrations tables', async () => {
    const token = await admin_token()
    const response = await call({ token, source: 'shared' })
    const body = await response.json() as { schema: { source_label: string, tables: { name: string }[] } }
    expect(body.schema.source_label).toBe('server shared.db')
    const table_names = body.schema.tables.map(t => t.name)
    expect(table_names).toContain('users')
    expect(table_names).toContain('migrations')
  })

  test('200 for admin — dictionary.db returns entries + senses tables', async () => {
    const token = await admin_token()
    const response = await call({ token, source: 'dictionary' })
    const body = await response.json() as { schema: { source_label: string, tables: { name: string, row_count: number | null }[] } }
    expect(body.schema.source_label).toBe('server dictionary.db')
    const table_names = body.schema.tables.map(t => t.name)
    expect(table_names).toContain('entries')
    expect(table_names).toContain('senses')
    // preview DB is introspected with skip_row_counts.
    expect(body.schema.tables[0].row_count).toBeNull()
  })
})
