import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { POST } from './+server'

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
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run('user-1', 'user@example.com', 'Old Name',
      JSON.stringify([{ provider: 'email', provider_id: 'user@example.com' }]),
      '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
})

afterEach(() => {
  db.close()
})

function token() {
  return sign_jwt({ sub: 'user-1', email: 'user@example.com', name: 'Old Name' })
}

function call(options: { token?: string, body: unknown }) {
  const request = new Request('http://localhost/api/auth/update-profile', {
    method: 'POST',
    body: JSON.stringify(options.body),
    headers: { 'content-type': 'application/json' },
  })
  const cookies = {
    get: (name: string) => (name === 'session' ? options.token : undefined),
  }
  return POST({ request, cookies } as unknown as Parameters<typeof POST>[0])
}

function name_in_db() {
  return (db.prepare('SELECT name FROM users WHERE id = ?').get('user-1') as { name: string }).name
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ body: { name: 'New Name' } }))
      .rejects.toMatchObject({ status: 401 })
  })

  test('400 when nothing to update', async () => {
    await expect(call({ token: await token(), body: {} }))
      .rejects.toMatchObject({ status: 400 })
  })

  test('400 on empty / whitespace-only name', async () => {
    await expect(call({ token: await token(), body: { name: '   ' } }))
      .rejects.toMatchObject({ status: 400 })
    expect(name_in_db()).toBe('Old Name')
  })

  test('400 on non-string name', async () => {
    await expect(call({ token: await token(), body: { name: 42 } }))
      .rejects.toMatchObject({ status: 400 })
  })

  test('400 on control characters', async () => {
    await expect(call({ token: await token(), body: { name: `Bad${String.fromCharCode(0)}Name` } }))
      .rejects.toMatchObject({ status: 400 })
  })

  test('400 when name exceeds the max length', async () => {
    await expect(call({ token: await token(), body: { name: 'a'.repeat(81) } }))
      .rejects.toMatchObject({ status: 400 })
  })

  test('updates the name, trims it, and returns the refreshed user', async () => {
    const response = await call({ token: await token(), body: { name: '  Jake  ' } })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.id).toBe('user-1')
    expect(data.name).toBe('Jake')
    expect(name_in_db()).toBe('Jake')
  })

  function unsubscribed_in_db() {
    return (db.prepare('SELECT unsubscribed_from_emails FROM users WHERE id = ?').get('user-1') as { unsubscribed_from_emails: string | null }).unsubscribed_from_emails
  }

  test('unsubscribes and re-subscribes from the newsletter', async () => {
    await call({ token: await token(), body: { unsubscribed_from_emails: true } })
    expect(unsubscribed_in_db()).not.toBe(null)
    const response = await call({ token: await token(), body: { unsubscribed_from_emails: false } })
    const data = await response.json()
    expect(data.unsubscribed_from_emails).toBeFalsy()
    expect(unsubscribed_in_db()).toBe(null)
  })

  test('400 on non-boolean unsubscribed_from_emails', async () => {
    await expect(call({ token: await token(), body: { unsubscribed_from_emails: 'yes' } }))
      .rejects.toMatchObject({ status: 400 })
  })

  test('bumps updated_at so admin mirrors pull the change', async () => {
    await call({ token: await token(), body: { name: 'Jake' } })
    const { updated_at } = db.prepare('SELECT updated_at FROM users WHERE id = ?').get('user-1') as { updated_at: string }
    expect(updated_at).not.toBe('2025-01-01T00:00:00Z')
  })
})
