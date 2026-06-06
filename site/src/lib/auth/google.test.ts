import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

/**
 * `verify_google_id_token` uses jose's `createRemoteJWKSet` against
 * `https://www.googleapis.com/oauth2/v3/certs`. To test the verifier
 * end-to-end without hitting Google, we:
 *   1. Generate an RS256 keypair in `beforeAll`.
 *   2. Stub `globalThis.fetch` so any GET to the Google JWKS URL returns our
 *      generated public key.
 *   3. Sign tokens with the private key + various claim shapes.
 */

const TEST_CLIENT_ID = '801822037572-test.apps.googleusercontent.com'

let private_key: CryptoKey
let public_jwk: Awaited<ReturnType<typeof exportJWK>>

beforeAll(async () => {
  const keypair = await generateKeyPair('RS256')
  private_key = keypair.privateKey
  public_jwk = await exportJWK(keypair.publicKey)
  public_jwk.kid = 'test-key-1'
  public_jwk.alg = 'RS256'
  public_jwk.use = 'sig'

  process.env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID = TEST_CLIENT_ID
})

beforeEach(() => {
  const jwks = { keys: [public_jwk] }
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes('googleapis.com/oauth2/v3/certs')) {
      return Promise.resolve(new Response(JSON.stringify(jwks), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    }
    return Promise.reject(new Error(`Unexpected fetch in google.test.ts: ${url}`))
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  // Drop module cache so each test gets a fresh `createRemoteJWKSet` that
  // re-fetches from our stub.
  vi.resetModules()
})

interface MakeTokenOptions {
  audience?: string
  issuer?: string
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  expires_in_seconds?: number
}

function make_token(options: MakeTokenOptions = {}) {
  const {
    audience = TEST_CLIENT_ID,
    issuer = 'https://accounts.google.com',
    sub = 'google-sub-123',
    email = 'user@gmail.com',
    email_verified = true,
    name = 'Google User',
    picture = 'https://lh3.googleusercontent.com/photo.jpg',
    expires_in_seconds = 60 * 60,
  } = options

  return new SignJWT({ email, email_verified, name, picture })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${expires_in_seconds}s`)
    .sign(private_key)
}

describe('verify_google_id_token', () => {
  test('accepts a valid token with correct audience and issuer', async () => {
    const { verify_google_id_token } = await import('./google')
    const token = await make_token()
    const payload = await verify_google_id_token(token)
    expect(payload).toEqual({
      sub: 'google-sub-123',
      email: 'user@gmail.com',
      name: 'Google User',
      picture: 'https://lh3.googleusercontent.com/photo.jpg',
    })
  })

  test('accepts the legacy `accounts.google.com` issuer (no https://)', async () => {
    const { verify_google_id_token } = await import('./google')
    const token = await make_token({ issuer: 'accounts.google.com' })
    const payload = await verify_google_id_token(token)
    expect(payload.email).toBe('user@gmail.com')
  })

  test('rejects a token issued for a different OAuth client (audience mismatch)', async () => {
    const { verify_google_id_token } = await import('./google')
    const token = await make_token({ audience: 'attacker-client.apps.googleusercontent.com' })
    await expect(verify_google_id_token(token)).rejects.toThrow()
  })

  test('rejects a token from a non-Google issuer', async () => {
    const { verify_google_id_token } = await import('./google')
    const token = await make_token({ issuer: 'https://evil.com' })
    await expect(verify_google_id_token(token)).rejects.toThrow()
  })

  test('rejects a token where email_verified is false', async () => {
    const { verify_google_id_token } = await import('./google')
    const token = await make_token({ email_verified: false })
    await expect(verify_google_id_token(token)).rejects.toThrow(/email is not verified/)
  })

  test('rejects an expired token', async () => {
    const { verify_google_id_token } = await import('./google')
    const token = await make_token({ expires_in_seconds: -10 })
    await expect(verify_google_id_token(token)).rejects.toThrow()
  })

  test('rejects a tampered (signature-broken) token', async () => {
    const { verify_google_id_token } = await import('./google')
    const token = await make_token()
    const tampered = `${token.slice(0, -10)}TAMPERED99`
    await expect(verify_google_id_token(tampered)).rejects.toThrow()
  })

  test('throws if PUBLIC_GOOGLE_OAUTH_CLIENT_ID is missing', async () => {
    const original = process.env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID
    delete process.env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID
    try {
      const { verify_google_id_token } = await import('./google')
      const token = await make_token()
      await expect(verify_google_id_token(token)).rejects.toThrow(/PUBLIC_GOOGLE_OAUTH_CLIENT_ID/)
    } finally {
      process.env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID = original
    }
  })
})
