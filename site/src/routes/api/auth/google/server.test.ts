import type { UserProviderIdentity } from '$lib/db/schemas/shared.types'
import type { AuthGoogleResponseBody } from './+server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_shared_db } from '$lib/db/server/shared-db'
import { POST } from './+server'

let db: ReturnType<typeof open_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return {
    ...actual,
    get_shared_db: () => db,
  }
})

vi.mock('$lib/auth/google', () => ({
  verify_google_id_token: vi.fn((id_token: string) => {
    if (id_token === 'valid-google-token') {
      return {
        sub: 'google-sub-123',
        email: 'user@gmail.com',
        name: 'Google User',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
      }
    }
    throw new Error('Invalid token')
  }),
}))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_shared_db(':memory:')
})

afterEach(() => {
  db.close()
})

interface CookieSet {
  name: string
  value: string
  opts: Record<string, unknown>
}

function call(body: unknown) {
  const cookies_set: CookieSet[] = []
  const cookies = {
    set: (name: string, value: string, opts: Record<string, unknown>) => {
      cookies_set.push({ name, value, opts })
    },
    delete: () => { /* no-op for happy-path tests */ },
    get: () => undefined,
  }
  const request = new Request('http://localhost/api/auth/google', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { promise: POST({ request, cookies } as unknown as Parameters<typeof POST>[0]), cookies_set }
}

describe(POST, () => {
  test('rejects when id_token is missing', async () => {
    const { promise } = call({})
    await expect(promise).rejects.toMatchObject({ status: 400 })
  })

  test('rejects an invalid Google ID token with 401', async () => {
    const { promise } = call({ id_token: 'bad-token' })
    await expect(promise).rejects.toMatchObject({ status: 401 })
  })

  test('creates a new user from a valid Google token and sets session cookie', async () => {
    const { promise, cookies_set } = call({ id_token: 'valid-google-token' })
    const response = await promise
    expect(response.status).toBe(200)

    const body = await response.json() as AuthGoogleResponseBody
    expect(body.user.email).toBe('user@gmail.com')
    expect(body.user.name).toBe('Google User')
    expect(body.user.avatar_url).toBe('https://lh3.googleusercontent.com/photo.jpg')

    const session_cookie = cookies_set.find(c => c.name === 'session')
    expect(session_cookie).toBeTruthy()
    expect(session_cookie?.opts).toMatchObject({
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    })
    expect(typeof session_cookie?.value).toBe('string')
    expect(session_cookie?.value).toBeTruthy()
  })

  test('stores the google identity in the users.providers JSON array', async () => {
    const { promise } = call({ id_token: 'valid-google-token' })
    const response = await promise
    const body = await response.json() as AuthGoogleResponseBody

    const row = db.prepare('SELECT providers FROM users WHERE id = ?').get(body.user.id) as { providers: string }
    const providers = JSON.parse(row.providers) as UserProviderIdentity[]
    expect(providers).toEqual([{ provider: 'google', provider_id: 'google-sub-123' }])
  })

  test('returns the same user on subsequent logins (no duplicate row)', async () => {
    const response1 = await call({ id_token: 'valid-google-token' }).promise
    const body1 = await response1.json() as AuthGoogleResponseBody

    const response2 = await call({ id_token: 'valid-google-token' }).promise
    const body2 = await response2.json() as AuthGoogleResponseBody

    expect(body1.user.id).toBe(body2.user.id)
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
    expect(count.c).toBe(1)
  })

  test('links to an existing email-OTP user with the same Gmail address', async () => {
    const existing_providers: UserProviderIdentity[] = [{ provider: 'email', provider_id: 'user@gmail.com' }]
    db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .run('existing-id', 'user@gmail.com', 'Existing User', JSON.stringify(existing_providers), '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')

    const response = await call({ id_token: 'valid-google-token' }).promise
    const body = await response.json() as AuthGoogleResponseBody
    expect(body.user.id).toBe('existing-id')

    const row = db.prepare('SELECT providers FROM users WHERE id = ?').get('existing-id') as { providers: string }
    const providers = JSON.parse(row.providers) as UserProviderIdentity[]
    expect(providers).toEqual([
      { provider: 'email', provider_id: 'user@gmail.com' },
      { provider: 'google', provider_id: 'google-sub-123' },
    ])

    const count = db.prepare('SELECT COUNT(*) as c FROM users WHERE email = ?').get('user@gmail.com') as { c: number }
    expect(count.c).toBe(1)
  })

  test('refreshes avatar and name from Google on re-login', async () => {
    await call({ id_token: 'valid-google-token' }).promise

    const user_row = db.prepare('SELECT id FROM users').get() as { id: string }
    db.prepare('UPDATE users SET name = ?, avatar_url = ? WHERE id = ?').run(
      'Old Name', 'https://old-photo.example.com/x.jpg', user_row.id,
    )

    const response = await call({ id_token: 'valid-google-token' }).promise
    const body = await response.json() as AuthGoogleResponseBody
    expect(body.user.name).toBe('Google User')
    expect(body.user.avatar_url).toBe('https://lh3.googleusercontent.com/photo.jpg')
  })
})
