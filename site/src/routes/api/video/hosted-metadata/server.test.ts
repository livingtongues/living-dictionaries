import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { fetch_hosted_video_metadata } from '$lib/video/hosted-video-metadata'
import { POST } from './+server'

vi.mock('$lib/video/hosted-video-metadata', () => ({ fetch_hosted_video_metadata: vi.fn() }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

async function event(body: unknown, { authenticated = true } = {}) {
  const token = authenticated ? await sign_jwt({ sub: 'user-1', email: 'editor@example.com', name: 'Editor' }) : undefined
  return {
    request: new Request('http://localhost/api/video/hosted-metadata', { method: 'POST', body: JSON.stringify(body) }),
    cookies: { get: (name: string) => name === 'session' ? token : undefined },
  } as never
}

describe(POST, () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns normalized metadata for a valid reference', async () => {
    vi.mocked(fetch_hosted_video_metadata).mockResolvedValue({ title: 'Clip', thumbnail_url: 'https://example.com/thumb.jpg' })
    const response = await POST(await event({ hosted_video: { type: 'youtube', video_id: 'abc', start_at_seconds: 12 } }))
    expect(await response.json()).toEqual({ metadata: { title: 'Clip', thumbnail_url: 'https://example.com/thumb.jpg' } })
  })

  test('returns null without rejecting when provider metadata is unavailable', async () => {
    vi.mocked(fetch_hosted_video_metadata).mockResolvedValue(undefined)
    const response = await POST(await event({ hosted_video: { type: 'vimeo', video_id: '123' } }))
    expect(await response.json()).toEqual({ metadata: null })
  })

  test('rejects invalid provider data', async () => {
    await expect(POST(await event({ hosted_video: { type: 'other', video_id: 'abc' } }))).rejects.toMatchObject({ status: 400 })
    expect(fetch_hosted_video_metadata).not.toHaveBeenCalled()
  })

  test('rejects unauthenticated metadata proxy requests', async () => {
    await expect(POST(await event({ hosted_video: { type: 'youtube', video_id: 'abc' } }, { authenticated: false }))).rejects.toMatchObject({ status: 401 })
  })
})
