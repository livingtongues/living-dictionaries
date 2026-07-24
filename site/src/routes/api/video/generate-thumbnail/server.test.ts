import type { Database } from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { post_large_video_notification } from '$lib/server/chat/large-video-notifier'
import { POST } from './+server'

let db: Database

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

// Never touch R2/ffmpeg from the test — assert only that the fast path accepts + gates.
const generated: { original_key: string }[] = []
vi.mock('$lib/server/video-thumbnails', () => ({
  store_video_thumbnail_in_background: (options: { original_key: string }) => generated.push(options),
}))
vi.mock('$lib/db/server/dictionary-db', () => ({ get_dictionary_db: () => ({ test: 'dict-db' }) }))
vi.mock('$lib/server/chat/large-video-notifier', () => ({ post_large_video_notification: vi.fn(() => true) }))

const uuid = '48af49b0-b410-4db1-babf-38ac53269e62'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_test_shared_db()
  const now = '2026-01-01T00:00:00Z'
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u_con', 'contributor@example.com', 'Contributor', JSON.stringify([]), now, now)
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u_none', 'norole@example.com', 'No Role', JSON.stringify([]), now, now)
  db.prepare(`INSERT INTO dictionaries (id, url, name, entry_count, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`)
    .run('dict1', 'dict1', 'Dict One', now, now)
  db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('r_con', 'dict1', 'u_con', 'contributor', now, now)
  generated.length = 0
  vi.mocked(post_large_video_notification).mockClear()
})

afterEach(() => db.close())

function token(user: { id: string, email: string }) {
  return sign_jwt({ sub: user.id, email: user.email, name: user.email })
}

const valid_body = { dictionary_id: 'dict1', storage_path: `dict1/video/${uuid}.webm` }

function call(options: { token?: string, body: unknown }) {
  const request = new Request('http://localhost/api/video/generate-thumbnail', {
    method: 'POST',
    body: JSON.stringify(options.body),
    headers: { 'content-type': 'application/json' },
  })
  const cookies = { get: (name: string) => (name === 'session' ? options.token : undefined) }
  return POST({ request, cookies, url: new URL(request.url) } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ body: valid_body })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for a user with no role on the dictionary', async () => {
    await expect(call({ token: await token({ id: 'u_none', email: 'norole@example.com' }), body: valid_body }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('400 when storage_path missing', async () => {
    await expect(call({ token: await token({ id: 'u_con', email: 'contributor@example.com' }), body: { ...valid_body, storage_path: '' } }))
      .rejects.toMatchObject({ status: 400 })
  })

  test('404 when dictionary not found', async () => {
    await expect(call({ token: await token({ id: 'u_con', email: 'contributor@example.com' }), body: { ...valid_body, dictionary_id: 'nope' } }))
      .rejects.toMatchObject({ status: 404 })
  })

  test('400 when storage_path is not a new-convention video for this dict', async () => {
    for (const bad of [`dict1/photo/${uuid}.jpg`, `other/video/${uuid}.webm`, `dict1/video/${uuid}_thumb.webp`, 'dict1/videos/legacy_123.mp4']) {
      await expect(call({ token: await token({ id: 'u_con', email: 'contributor@example.com' }), body: { ...valid_body, storage_path: bad } }))
        .rejects.toMatchObject({ status: 400 })
    }
  })

  test('contributor: accepts + kicks off background generation for the right key', async () => {
    const response = await call({ token: await token({ id: 'u_con', email: 'contributor@example.com' }), body: valid_body })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ accepted: true })
    expect(generated).toEqual([{ original_key: `dict1/video/${uuid}.webm` }])
    expect(post_large_video_notification).not.toHaveBeenCalled()
  })

  test('video above 25 MiB posts one entry-linked review notification', async () => {
    const response = await call({
      token: await token({ id: 'u_con', email: 'contributor@example.com' }),
      body: { ...valid_body, sense_id: 'sense-1', file_size: 25 * 1024 * 1024 + 1 },
    })
    expect(response.status).toBe(200)
    expect(post_large_video_notification).toHaveBeenCalledWith(expect.objectContaining({
      cell_key: 'video:sense',
      owner_id: 'sense-1',
      media_id: uuid,
      size_bytes: 25 * 1024 * 1024 + 1,
      actor_user_id: 'u_con',
      base_url: 'http://localhost',
    }))
  })
})
