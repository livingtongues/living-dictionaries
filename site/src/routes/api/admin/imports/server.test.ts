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

const ADMIN_USER_ID = 'admin-user-id'
const DIEGO_USER_ID = 'diego-user-id'
const NON_ADMIN_USER_ID = 'regular-user-id'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_test_shared_db()
  const now = '2026-08-05T12:00:00.000Z'
  const insert_user = db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
  insert_user.run(ADMIN_USER_ID, 'jwrunner7@gmail.com', 'Jacob', '[]', now, now)
  insert_user.run(DIEGO_USER_ID, 'diego@livingtongues.org', 'Diego', '[]', now, now)
  insert_user.run(NON_ADMIN_USER_ID, 'manager@example.com', 'Manager', '[]', now, now)
  db.prepare('INSERT INTO dictionaries (id, name, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('demo', 'Demo Dictionary', 'demo', now, now)
  db.prepare(`
    INSERT INTO message_threads (
      id, subject, source, thread_kind, from_user_id, from_email, from_name,
      dictionary_id, assigned_to_user_id, last_message_at, created_at, updated_at
    ) VALUES (?, ?, 'contact_form', 'import', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'import-thread',
    'Import request: Demo Dictionary',
    NON_ADMIN_USER_ID,
    'manager@example.com',
    'Manager',
    'demo',
    DIEGO_USER_ID,
    now,
    now,
    now,
  )
})

afterEach(() => {
  db.close()
})

function call(token?: string) {
  const request = new Request('http://localhost/api/admin/imports')
  const cookies = { get: (name: string) => (name === 'session' ? token : undefined) }
  return GET({ request, cookies } as unknown as Parameters<typeof GET>[0])
}

describe(GET, () => {
  test('401 without auth', async () => {
    await expect(call()).rejects.toMatchObject({ status: 401 })
  })

  test('403 for a non-admin', async () => {
    const token = await sign_jwt({ sub: NON_ADMIN_USER_ID, email: 'manager@example.com', name: 'Manager' })
    await expect(call(token)).rejects.toMatchObject({ status: 403 })
  })

  test('returns the persisted assignee user id and display fields', async () => {
    const token = await sign_jwt({ sub: ADMIN_USER_ID, email: 'jwrunner7@gmail.com', name: 'Jacob' })
    const response = await call(token)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.imports).toHaveLength(1)
    expect(body.imports[0]).toMatchObject({
      thread_id: 'import-thread',
      assigned_to_user_id: DIEGO_USER_ID,
      assignee_name: 'Diego',
      assignee_email: 'diego@livingtongues.org',
    })
  })
})
