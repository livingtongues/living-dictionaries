import { env } from '$env/dynamic/private'
import { decodeJwt, jwtVerify, SignJWT } from 'jose'

const ALGORITHM = 'HS256'
export const EXPIRY_SECONDS = 60 * 60 * 24 * 31 // 31 days
const REFRESH_AFTER_SECONDS = 60 * 60 * 24 // sliding session: re-issue past 1 day

export interface JWTPayload {
  sub: string
  /** Omitted from the signed token when not set. */
  email?: string
  /** Omitted from the signed token when not set. */
  name?: string
}

function get_secret(): Uint8Array {
  const secret = env.JWT_SECRET
  if (!secret)
    throw new Error('JWT_SECRET environment variable is required')
  return new TextEncoder().encode(secret)
}

export function sign_jwt({ sub, email, name }: JWTPayload): Promise<string> {
  const claims: Record<string, string> = {}
  if (email)
    claims.email = email
  if (name)
    claims.name = name
  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_SECONDS}s`)
    .sign(get_secret())
}

export async function verify_jwt(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, get_secret())
  return {
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  }
}

/**
 * Sliding sessions: when a valid token is older than 1 day, mint a fresh 31d one
 * (delivered by re-setting the `session` cookie in `hooks.server.ts`). Anyone
 * active at least once every 30 days never re-authenticates, with at most one
 * re-sign per client per day.
 *
 * The staleness gate reads `iat` via an UNVERIFIED decode first, so the steady
 * state (fresh token) costs one base64 decode per request rather than an HMAC
 * verify. Full verification only runs for the rare stale token, and a token that
 * fails it gets no refresh (the layout's own `verify_jwt` still self-clears).
 */
export async function refresh_jwt_if_stale(token: string): Promise<string | null> {
  try {
    const { iat } = decodeJwt(token)
    if (!iat || Date.now() / 1000 - iat < REFRESH_AFTER_SECONDS)
      return null
    const payload = await verify_jwt(token)
    return await sign_jwt(payload)
  } catch {
    return null
  }
}

if (import.meta.vitest) {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
  })

  describe(sign_jwt, () => {
    it('produces a valid JWT with correct claims', async () => {
      const token = await sign_jwt({ sub: 'user-123', email: 'test@test.com', name: 'Test User' })
      const parts = token.split('.')
      expect(parts).toHaveLength(3)

      const payload = await verify_jwt(token)
      expect(payload.sub).toBe('user-123')
      expect(payload.email).toBe('test@test.com')
      expect(payload.name).toBe('Test User')
    })

    it('omits email and name claims when not provided', async () => {
      const token = await sign_jwt({ sub: 'user-no-email' })
      const payload = await verify_jwt(token)
      expect(payload.sub).toBe('user-no-email')
      expect(payload.email).toBeUndefined()
      expect(payload.name).toBeUndefined()
    })

    it('omits claims passed as empty strings', async () => {
      const token = await sign_jwt({ sub: 'x', email: '', name: '' })
      const payload = await verify_jwt(token)
      expect(payload.email).toBeUndefined()
      expect(payload.name).toBeUndefined()
    })
  })

  describe(verify_jwt, () => {
    it('returns claims for a valid token', async () => {
      const token = await sign_jwt({ sub: 'abc', email: 'a@b.com', name: 'A' })
      const payload = await verify_jwt(token)
      expect(payload.sub).toBe('abc')
      expect(payload.email).toBe('a@b.com')
      expect(payload.name).toBe('A')
    })

    it('rejects tokens signed with wrong secret', async () => {
      const wrong_secret = new TextEncoder().encode('wrong-secret-wrong-secret-wrong-secret')
      const token = await new SignJWT({ email: 'a@b.com', name: 'A' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('abc')
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(wrong_secret)

      await expect(verify_jwt(token)).rejects.toThrow()
    })

    it('rejects expired tokens', async () => {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET)
      const token = await new SignJWT({ email: 'a@b.com', name: 'A' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('abc')
        .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
        .sign(secret)

      await expect(verify_jwt(token)).rejects.toThrow()
    })

    it('rejects malformed tokens', async () => {
      await expect(verify_jwt('not-a-jwt')).rejects.toThrow()
      await expect(verify_jwt('')).rejects.toThrow()
    })

    it('sets 31-day expiry', async () => {
      const before = Math.floor(Date.now() / 1000)
      const token = await sign_jwt({ sub: 'x', email: 'x@x.com', name: 'X' })
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET))
      const after = Math.floor(Date.now() / 1000)

      const expected_exp_min = before + EXPIRY_SECONDS
      const expected_exp_max = after + EXPIRY_SECONDS
      expect(payload.exp).toBeGreaterThanOrEqual(expected_exp_min)
      expect(payload.exp).toBeLessThanOrEqual(expected_exp_max)
    })
  })

  describe(refresh_jwt_if_stale, () => {
    function signed_with_iat(iat_seconds_ago: number, secret = process.env.JWT_SECRET) {
      const now = Math.floor(Date.now() / 1000)
      return new SignJWT({ email: 'a@b.com', name: 'A' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('user-1')
        .setIssuedAt(now - iat_seconds_ago)
        .setExpirationTime(now - iat_seconds_ago + EXPIRY_SECONDS)
        .sign(new TextEncoder().encode(secret))
    }

    it('returns null for a fresh token', async () => {
      const token = await sign_jwt({ sub: 'user-1', email: 'a@b.com' })
      expect(await refresh_jwt_if_stale(token)).toBe(null)
    })

    it('returns null for a token under 1 day old', async () => {
      const token = await signed_with_iat(60 * 60 * 12)
      expect(await refresh_jwt_if_stale(token)).toBe(null)
    })

    it('re-issues a full 31d token once older than 1 day, preserving claims', async () => {
      const token = await signed_with_iat(60 * 60 * 25)
      const refreshed = await refresh_jwt_if_stale(token)
      expect(refreshed).not.toBe(null)

      const payload = await verify_jwt(refreshed)
      expect(payload.sub).toBe('user-1')
      expect(payload.email).toBe('a@b.com')
      expect(payload.name).toBe('A')

      const { payload: raw } = await jwtVerify(refreshed, new TextEncoder().encode(process.env.JWT_SECRET))
      const now = Math.floor(Date.now() / 1000)
      expect(raw.exp).toBeGreaterThanOrEqual(now + EXPIRY_SECONDS - 5)
    })

    it('returns null for a stale token signed with the wrong secret', async () => {
      const forged = await signed_with_iat(60 * 60 * 25, 'wrong-secret-wrong-secret-wrong-secret')
      expect(await refresh_jwt_if_stale(forged)).toBe(null)
    })

    it('returns null for garbage', async () => {
      expect(await refresh_jwt_if_stale('not-a-jwt')).toBe(null)
    })
  })
}
