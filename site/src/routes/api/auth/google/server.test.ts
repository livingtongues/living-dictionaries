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

/**
 * Two token fixtures: a plain user, and an admin whose GOOGLE verified email
 * differs from their allow-listed primary email (the demotion-risk case).
 */
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
    if (id_token === 'greg-personal-gmail-token') {
      return {
        sub: 'google-sub-greg',
        email: 'greg.personal@gmail.com',
        name: 'Greg (Google Profile Name)',
        picture: 'https://lh3.googleusercontent.com/greg.jpg',
      }
    }
    throw new Error('Invalid token')
  }),
}))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
  process.env.NTFY_DISABLED = '1'
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
  const url = new URL('http://localhost/api/auth/google')
  return { promise: POST({ request, cookies, url } as unknown as Parameters<typeof POST>[0]), cookies_set }
}

/** Decode a JWT's payload without verifying — enough to assert the claims we signed. */
function jwt_claims(token: string): { sub: string, email?: string, name?: string } {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
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
  })

  test('returns the same user on subsequent logins (no duplicate row)', async () => {
    const response1 = await call({ id_token: 'valid-google-token' }).promise
    const body1 = await response1.json() as AuthGoogleResponseBody

    const response2 = await call({ id_token: 'valid-google-token' }).promise
    const body2 = await response2.json() as AuthGoogleResponseBody

    expect(body1.user.id).toBe(body2.user.id)
    const count = db.prepare('SELECT COUNT(*) as c FROM users WHERE email = ?').get('user@gmail.com') as { c: number }
    expect(count.c).toBe(1)
  })

  test('refreshes avatar from Google on re-login but PRESERVES the user\'s name + primary email', async () => {
    await call({ id_token: 'valid-google-token' }).promise

    const user_row = db.prepare('SELECT id FROM users WHERE email = ?').get('user@gmail.com') as { id: string }
    // Simulate a user who renamed themselves + a primary email that differs from
    // the Google address (e.g. an admin's allow-list email kept as primary).
    db.prepare('UPDATE users SET name = ?, email = ?, avatar_url = ? WHERE id = ?').run(
      'Chosen Name', 'canonical@allowlist.test', 'https://old-photo.example.com/x.jpg', user_row.id,
    )

    const response = await call({ id_token: 'valid-google-token' }).promise
    const body = await response.json() as AuthGoogleResponseBody
    // Name + primary email are the user's own — a provider login must not flip them.
    expect(body.user.name).toBe('Chosen Name')
    expect(body.user.email).toBe('canonical@allowlist.test')
    // Avatar is refreshed from the latest Google profile.
    expect(body.user.avatar_url).toBe('https://lh3.googleusercontent.com/photo.jpg')
  })

  test('an allow-listed admin logging in via Google with a DIFFERENT verified email keeps primary email, admin level, and canonical JWT claims', async () => {
    // Greg's allow-listed primary email (level 2 in $lib/admins.ts) with his
    // Google sub already linked — e.g. from a prior login or an admin merge.
    const providers: UserProviderIdentity[] = [
      { provider: 'email', provider_id: 'livingtongues@gmail.com' },
      { provider: 'google', provider_id: 'google-sub-greg' },
    ]
    db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .run('greg-id', 'livingtongues@gmail.com', 'Dr. Greg Anderson', JSON.stringify(providers), '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')

    // Google delivers a DIFFERENT verified email (his personal address).
    const { promise, cookies_set } = call({ id_token: 'greg-personal-gmail-token' })
    const response = await promise
    const body = await response.json() as AuthGoogleResponseBody

    // Same account — no fork.
    expect(body.user.id).toBe('greg-id')
    // Primary email + name stay canonical (the allow-list keeps matching)…
    expect(body.user.email).toBe('livingtongues@gmail.com')
    expect(body.user.name).toBe('Dr. Greg Anderson')
    const row = db.prepare('SELECT email, name FROM users WHERE id = ?').get('greg-id') as { email: string, name: string }
    expect(row.email).toBe('livingtongues@gmail.com')
    expect(row.name).toBe('Dr. Greg Anderson')
    // …so the admin level survives the Google login.
    expect(body.user.admin_level).toBe(2)
    expect(body.user.is_admin).toBeTruthy()

    // The JWT is signed from the CANONICAL resolved user, not the Google profile.
    const session_cookie = cookies_set.find(c => c.name === 'session')
    expect(session_cookie).toBeTruthy()
    const claims = jwt_claims(session_cookie.value)
    expect(claims.sub).toBe('greg-id')
    expect(claims.email).toBe('livingtongues@gmail.com')
    expect(claims.name).toBe('Dr. Greg Anderson')
  })
})
