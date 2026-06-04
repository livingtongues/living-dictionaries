import { sign_jwt } from './jwt'
import { verify_auth } from './verify'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

function make_event({ token_in_cookie, token_in_header, malformed_header }: {
  token_in_cookie?: string
  token_in_header?: string
  malformed_header?: string
} = {}) {
  const headers: Record<string, string> = {}
  if (token_in_header)
    headers.Authorization = `Bearer ${token_in_header}`
  if (malformed_header)
    headers.Authorization = malformed_header
  const request = new Request('http://localhost', { headers })
  const cookies = {
    get: (name: string) => (name === 'session' ? token_in_cookie : undefined),
  }
  return { request, cookies }
}

describe(verify_auth, () => {
  test('extracts user_id from cookie session', async () => {
    const token = await sign_jwt({ sub: 'user-42', email: 'test@test.com', name: 'Test' })
    const result = await verify_auth(make_event({ token_in_cookie: token }))
    expect(result.user_id).toBe('user-42')
    expect(result.email).toBe('test@test.com')
    expect(result.name).toBe('Test')
  })

  test('falls back to Authorization Bearer header when cookie missing', async () => {
    const token = await sign_jwt({ sub: 'user-42', email: 'test@test.com', name: 'Test' })
    const result = await verify_auth(make_event({ token_in_header: token }))
    expect(result.user_id).toBe('user-42')
  })

  test('cookie takes precedence over header when both present', async () => {
    const cookie_token = await sign_jwt({ sub: 'cookie-user', email: 'c@c.com', name: 'C' })
    const header_token = await sign_jwt({ sub: 'header-user', email: 'h@h.com', name: 'H' })
    const result = await verify_auth(make_event({
      token_in_cookie: cookie_token,
      token_in_header: header_token,
    }))
    expect(result.user_id).toBe('cookie-user')
  })

  test('throws 401 when both cookie and header are missing', async () => {
    await expect(verify_auth(make_event())).rejects.toMatchObject({ status: 401 })
  })

  test('throws 401 for invalid token in cookie', async () => {
    await expect(verify_auth(make_event({ token_in_cookie: 'garbage' }))).rejects.toMatchObject({
      status: 401,
    })
  })

  test('throws 401 for invalid token in header', async () => {
    await expect(verify_auth(make_event({ token_in_header: 'garbage' }))).rejects.toMatchObject({
      status: 401,
    })
  })

  test('throws 401 for malformed Authorization header (no Bearer prefix)', async () => {
    const token = await sign_jwt({ sub: 'user-42', email: 'test@test.com', name: 'Test' })
    await expect(verify_auth(make_event({ malformed_header: token }))).rejects.toMatchObject({
      status: 401,
    })
  })
})
