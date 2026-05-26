import { env } from '$env/dynamic/private'
import { jwtVerify, SignJWT } from 'jose'

const ALGORITHM = 'HS256'
export const EXPIRY_SECONDS = 60 * 60 * 24 * 30 // 30 days

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

if (import.meta.vitest) {
  const { describe, it, expect, beforeAll } = import.meta.vitest

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

    it('sets 30-day expiry', async () => {
      const before = Math.floor(Date.now() / 1000)
      const token = await sign_jwt({ sub: 'x', email: 'x@x.com', name: 'X' })
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET))
      const after = Math.floor(Date.now() / 1000)

      const expected_exp_min = before + 60 * 60 * 24 * 30
      const expected_exp_max = after + 60 * 60 * 24 * 30
      expect(payload.exp).toBeGreaterThanOrEqual(expected_exp_min)
      expect(payload.exp).toBeLessThanOrEqual(expected_exp_max)
    })
  })
}
