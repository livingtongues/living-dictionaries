import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_shared_db } from '$lib/db/server/shared-db'
import { POST } from './+server'

let db: ReturnType<typeof open_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

const ADMIN_EMAIL = 'jwrunner7@gmail.com'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_shared_db(':memory:')
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run('admin-1', ADMIN_EMAIL, 'Jacob',
      JSON.stringify([{ provider: 'email', provider_id: ADMIN_EMAIL }]),
      '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
})

afterEach(() => {
  db.close()
})

function admin_token() {
  return sign_jwt({ sub: 'admin-1', email: ADMIN_EMAIL, name: 'Jacob' })
}

function call(options: { token?: string, body: unknown }) {
  const request = new Request('http://localhost/api/admin/set-notify-channel', {
    method: 'POST',
    body: JSON.stringify(options.body),
    headers: { 'content-type': 'application/json' },
  })
  const cookies = { get: (name: string) => (name === 'session' ? options.token : undefined) }
  return POST({ request, cookies } as unknown as Parameters<typeof POST>[0])
}

function channel_of(user_id: string): string {
  return (db.prepare('SELECT notify_channel FROM users WHERE id = ?').get(user_id) as { notify_channel: string }).notify_channel
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ body: { channel: 'ntfy' } })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for a non-admin', async () => {
    const token = await sign_jwt({ sub: 'admin-1', email: 'stranger@example.com', name: 'Nope' })
    await expect(call({ token, body: { channel: 'ntfy' } })).rejects.toMatchObject({ status: 403 })
  })

  test('400 on an invalid channel', async () => {
    await expect(call({ token: await admin_token(), body: { channel: 'sms' } })).rejects.toMatchObject({ status: 400 })
  })

  test('sets the caller\'s channel and persists it', async () => {
    expect(channel_of('admin-1')).toBe('email')
    const response = await call({ token: await admin_token(), body: { channel: 'ntfy' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, channel: 'ntfy' })
    expect(channel_of('admin-1')).toBe('ntfy')
  })
})
