import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { POST } from './+server'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  delete process.env.PROCESS_IMAGE_URL
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function token() {
  return sign_jwt({ sub: 'u_ed', email: 'manager@example.com', name: 'Manager' })
}

function call(options: { token?: string, body: unknown }) {
  const request = new Request('http://localhost/api/gcs_serving_url', {
    method: 'POST',
    body: JSON.stringify(options.body),
    headers: { 'content-type': 'application/json' },
  })
  const cookies = { get: (name: string) => (name === 'session' ? options.token : undefined) }
  return POST({ request, cookies } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ body: { storage_path: 'bucket/images/1.jpg' } })).rejects.toMatchObject({ status: 401 })
  })

  test('400 when storage_path missing', async () => {
    await expect(call({ token: await token(), body: {} })).rejects.toMatchObject({ status: 400 })
  })

  test('503 when PROCESS_IMAGE_URL not configured', async () => {
    await expect(call({ token: await token(), body: { storage_path: 'bucket/images/1.jpg' } }))
      .rejects.toMatchObject({ status: 503 })
  })

  test('returns the lh3 serving_url id (prefix stripped)', async () => {
    process.env.PROCESS_IMAGE_URL = 'https://images.example/process'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('http://lh3.googleusercontent.com/abc123\n')))
    const response = await call({ token: await token(), body: { storage_path: 'bucket/images/1.jpg' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ serving_url: 'abc123' })
  })

  test('500 on an unexpected upstream response', async () => {
    process.env.PROCESS_IMAGE_URL = 'https://images.example/process'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('something went wrong')))
    await expect(call({ token: await token(), body: { storage_path: 'bucket/images/1.jpg' } }))
      .rejects.toMatchObject({ status: 500 })
  })
})
