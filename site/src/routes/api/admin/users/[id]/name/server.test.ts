import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { POST } from './+server'

let db: ReturnType<typeof open_test_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

const ADMIN_EMAIL = 'jwrunner7@gmail.com'
const ADMIN_USER_ID = 'admin-user-id'
const TARGET_USER_ID = 'target-user-id'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_test_shared_db()
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(ADMIN_USER_ID, ADMIN_EMAIL, 'Jacob', '[]', now, now)
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(TARGET_USER_ID, 'target@example.com', 'Old Name', '[]', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
})

afterEach(() => {
  db.close()
})

function admin_token() {
  return sign_jwt({ sub: ADMIN_USER_ID, email: ADMIN_EMAIL, name: 'Jacob' })
}
function non_admin_token() {
  return sign_jwt({ sub: TARGET_USER_ID, email: 'target@example.com', name: 'Old Name' })
}

function call(options: { token?: string, id?: string, body?: unknown } = {}) {
  const id = options.id ?? TARGET_USER_ID
  const request = new Request(`http://localhost/api/admin/users/${id}/name`, {
    method: 'POST',
    body: JSON.stringify(options.body ?? {}),
    headers: { 'Content-Type': 'application/json' },
  })
  const cookies = { get: (name: string) => (name === 'session' ? options.token : undefined) }
  return POST({ request, cookies, params: { id } } as unknown as Parameters<typeof POST>[0])
}

function read_name(user_id: string) {
  return (db.prepare('SELECT name FROM users WHERE id = ?').get(user_id) as { name: string | null }).name
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ body: { name: 'New' } })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for non-admin', async () => {
    const token = await non_admin_token()
    await expect(call({ token, body: { name: 'New' } })).rejects.toMatchObject({ status: 403 })
  })

  test('400 when name is not a string', async () => {
    const token = await admin_token()
    await expect(call({ token, body: { name: 42 } })).rejects.toMatchObject({ status: 400 })
    await expect(call({ token, body: {} })).rejects.toMatchObject({ status: 400 })
  })

  test('400 when name exceeds the max length', async () => {
    const token = await admin_token()
    await expect(call({ token, body: { name: 'a'.repeat(81) } })).rejects.toMatchObject({ status: 400 })
  })

  test('404 when user not found', async () => {
    const token = await admin_token()
    await expect(call({ token, id: 'missing', body: { name: 'New' } })).rejects.toMatchObject({ status: 404 })
  })

  test('happy path trims, updates the name and bumps updated_at', async () => {
    const token = await admin_token()
    const response = await call({ token, body: { name: '  Diego Córdova  ' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ result: 'success', name: 'Diego Córdova' })
    const row = db.prepare('SELECT name, updated_at FROM users WHERE id = ?').get(TARGET_USER_ID) as { name: string, updated_at: string }
    expect(row.name).toBe('Diego Córdova')
    expect(row.updated_at).not.toBe('2025-01-01T00:00:00Z')
  })

  test('blank name clears to null', async () => {
    const token = await admin_token()
    const response = await call({ token, body: { name: '   ' } })
    expect(response.status).toBe(200)
    expect(read_name(TARGET_USER_ID)).toBeNull()
  })
})
