import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { POST } from './+server'

// Silence ntfy pushes during tests (no network) — see notify-admins.ts.
process.env.NTFY_DISABLED = '1'

let db: ReturnType<typeof open_test_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return {
    ...actual,
    get_shared_db: () => db,
  }
})

const ADMIN_EMAIL = 'jwrunner7@gmail.com'
const ADMIN_USER_ID = 'admin-user-id'
const NON_ADMIN_USER_ID = 'regular-user-id'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_test_shared_db()
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(ADMIN_USER_ID, ADMIN_EMAIL, 'Jacob', '[]', now, now)
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(NON_ADMIN_USER_ID, 'alice@example.com', 'Alice', '[]', now, now)
  db.prepare(`INSERT INTO message_threads (id, source, from_email, last_message_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('thread-1', 'contact_form', 'customer@example.com', now, now, now)
})

afterEach(() => {
  db.close()
})

function admin_token() {
  return sign_jwt({ sub: ADMIN_USER_ID, email: ADMIN_EMAIL, name: 'Jacob' })
}

function non_admin_token() {
  return sign_jwt({ sub: NON_ADMIN_USER_ID, email: 'alice@example.com', name: 'Alice' })
}

function call(options: { token?: string, body?: unknown } = {}) {
  const request = new Request('http://localhost/api/messages/assign', {
    method: 'POST',
    body: JSON.stringify(options.body ?? {}),
    headers: { 'Content-Type': 'application/json' },
  })
  const cookies = { get: (name: string) => (name === 'session' ? options.token : undefined) }
  return POST({ request, cookies, url: new URL(request.url) } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ body: { thread_id: 'thread-1', assignee_user_id: ADMIN_USER_ID } })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for non-admin', async () => {
    const token = await non_admin_token()
    await expect(call({ token, body: { thread_id: 'thread-1', assignee_user_id: ADMIN_USER_ID } })).rejects.toMatchObject({ status: 403 })
  })

  test('400 when thread_id missing', async () => {
    const token = await admin_token()
    await expect(call({ token, body: { assignee_user_id: ADMIN_USER_ID } })).rejects.toMatchObject({ status: 400 })
  })

  test('404 when thread not found', async () => {
    const token = await admin_token()
    await expect(call({ token, body: { thread_id: 'missing', assignee_user_id: ADMIN_USER_ID } })).rejects.toMatchObject({ status: 404 })
  })

  test('400 when assignee is not an admin', async () => {
    const token = await admin_token()
    await expect(call({ token, body: { thread_id: 'thread-1', assignee_user_id: NON_ADMIN_USER_ID } })).rejects.toMatchObject({ status: 400 })
  })

  test('assigns thread to an admin', async () => {
    const token = await admin_token()
    const response = await call({ token, body: { thread_id: 'thread-1', assignee_user_id: ADMIN_USER_ID } })
    const body = await response.json() as { ok: boolean, assigned_to_user_id: string | null }
    expect(body.ok).toBeTruthy()
    expect(body.assigned_to_user_id).toBe(ADMIN_USER_ID)

    const row = db.prepare('SELECT assigned_to_user_id, assigned_by_user_id FROM message_threads WHERE id = ?').get('thread-1') as { assigned_to_user_id: string | null, assigned_by_user_id: string | null }
    expect(row.assigned_to_user_id).toBe(ADMIN_USER_ID)
    expect(row.assigned_by_user_id).toBe(ADMIN_USER_ID)
  })

  test('clears assignment with null assignee', async () => {
    const token = await admin_token()
    await call({ token, body: { thread_id: 'thread-1', assignee_user_id: ADMIN_USER_ID } })
    const response = await call({ token, body: { thread_id: 'thread-1', assignee_user_id: null } })
    const body = await response.json() as { ok: boolean, assigned_to_user_id: string | null }
    expect(body.ok).toBeTruthy()
    expect(body.assigned_to_user_id).toBeNull()

    const row = db.prepare('SELECT assigned_to_user_id FROM message_threads WHERE id = ?').get('thread-1') as { assigned_to_user_id: string | null }
    expect(row.assigned_to_user_id).toBeNull()
  })
})
