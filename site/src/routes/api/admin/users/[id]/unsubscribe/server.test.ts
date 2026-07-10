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
    .run(TARGET_USER_ID, 'target@example.com', 'Target', '[]', now, now)
})

afterEach(() => {
  db.close()
})

function admin_token() {
  return sign_jwt({ sub: ADMIN_USER_ID, email: ADMIN_EMAIL, name: 'Jacob' })
}
function non_admin_token() {
  return sign_jwt({ sub: TARGET_USER_ID, email: 'target@example.com', name: 'Target' })
}

function call(options: { token?: string, id?: string, body?: unknown } = {}) {
  const id = options.id ?? TARGET_USER_ID
  const request = new Request(`http://localhost/api/admin/users/${id}/unsubscribe`, {
    method: 'POST',
    body: JSON.stringify(options.body ?? {}),
    headers: { 'Content-Type': 'application/json' },
  })
  const cookies = { get: (name: string) => (name === 'session' ? options.token : undefined) }
  return POST({ request, cookies, params: { id } } as unknown as Parameters<typeof POST>[0])
}

function read_unsub(user_id: string) {
  return (db.prepare('SELECT unsubscribed_from_emails FROM users WHERE id = ?').get(user_id) as { unsubscribed_from_emails: string | null }).unsubscribed_from_emails
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ body: { unsubscribed: true } })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for non-admin', async () => {
    const token = await non_admin_token()
    await expect(call({ token, body: { unsubscribed: true } })).rejects.toMatchObject({ status: 403 })
  })

  test('400 when unsubscribed missing', async () => {
    const token = await admin_token()
    await expect(call({ token, body: {} })).rejects.toMatchObject({ status: 400 })
  })

  test('404 when user not found', async () => {
    const token = await admin_token()
    await expect(call({ token, id: 'missing', body: { unsubscribed: true } })).rejects.toMatchObject({ status: 404 })
  })

  test('sets and clears the unsubscribe flag', async () => {
    const token = await admin_token()
    expect(read_unsub(TARGET_USER_ID)).toBeNull()

    const set_response = await call({ token, body: { unsubscribed: true } })
    const set_body = await set_response.json() as { result: string, unsubscribed_from_emails: string | null }
    expect(set_body.result).toBe('success')
    expect(set_body.unsubscribed_from_emails).not.toBeNull()
    expect(read_unsub(TARGET_USER_ID)).not.toBeNull()

    const clear_response = await call({ token, body: { unsubscribed: false } })
    const clear_body = await clear_response.json() as { unsubscribed_from_emails: string | null }
    expect(clear_body.unsubscribed_from_emails).toBeNull()
    expect(read_unsub(TARGET_USER_ID)).toBeNull()
  })
})
