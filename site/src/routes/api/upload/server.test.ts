import type { Database } from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { reset_r2_media_client } from '$lib/server/r2-media'
import { POST } from './+server'

let db: Database

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://r2.example/signed-put-url'),
}))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_test_shared_db()
  const now = '2026-01-01T00:00:00Z'
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u_ed', 'manager@example.com', 'Manager', JSON.stringify([]), now, now)
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u_con', 'contributor@example.com', 'Contributor', JSON.stringify([]), now, now)
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u_none', 'norole@example.com', 'No Role', JSON.stringify([]), now, now)
  db.prepare(`INSERT INTO dictionaries (id, url, name, entry_count, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`)
    .run('dict1', 'dict1', 'Dict One', now, now)
  db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('r_ed', 'dict1', 'u_ed', 'manager', now, now)
  db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('r_con', 'dict1', 'u_con', 'contributor', now, now)

  reset_r2_media_client()
  delete process.env.R2_ACCOUNT_ID
  delete process.env.R2_ACCESS_KEY_ID
  delete process.env.R2_SECRET_ACCESS_KEY
})

afterEach(() => db.close())

function token(user: { id: string, email: string }) {
  return sign_jwt({ sub: user.id, email: user.email, name: user.email })
}

const media_id = '48af49b0-b410-4db1-babf-38ac53269e62'
const valid_body = { dictionary_id: 'dict1', file_name: 'voice.wav', file_type: 'audio/wav', file_size: 5, r2_media: { kind: 'audio', media_id } }

function set_creds() {
  process.env.R2_ACCOUNT_ID = 'test-account'
  process.env.R2_ACCESS_KEY_ID = 'test-key'
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
  reset_r2_media_client()
}

function call(options: { token?: string, body: unknown }) {
  const request = new Request('http://localhost/api/upload', {
    method: 'POST',
    body: JSON.stringify(options.body),
    headers: { 'content-type': 'application/json' },
  })
  const cookies = { get: (name: string) => (name === 'session' ? options.token : undefined) }
  return POST({ request, cookies } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ body: valid_body })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for a user with no role on the dictionary', async () => {
    await expect(call({ token: await token({ id: 'u_none', email: 'norole@example.com' }), body: valid_body }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('contributors may upload — they are the editing tier (client can_edit includes them)', async () => {
    const response = await call({ token: await token({ id: 'u_con', email: 'contributor@example.com' }), body: valid_body })
    expect(response.status).toBe(200)
  })

  test('400 when dictionary_id missing', async () => {
    await expect(call({ token: await token({ id: 'u_ed', email: 'manager@example.com' }), body: { ...valid_body, dictionary_id: '' } }))
      .rejects.toMatchObject({ status: 400 })
  })

  test('400 when file_name missing', async () => {
    await expect(call({ token: await token({ id: 'u_ed', email: 'manager@example.com' }), body: { ...valid_body, file_name: '' } }))
      .rejects.toMatchObject({ status: 400 })
  })

  test('400 when file_size is missing or invalid', async () => {
    const { file_size: _file_size, ...missing_size } = valid_body
    for (const body of [missing_size, { ...valid_body, file_size: 0 }, { ...valid_body, file_size: 1.5 }]) {
      await expect(call({ token: await token({ id: 'u_ed', email: 'manager@example.com' }), body }))
        .rejects.toMatchObject({ status: 400 })
    }
  })

  test('enforces 25 MiB for audio and 100 MiB for video', async () => {
    const auth_token = await token({ id: 'u_ed', email: 'manager@example.com' })
    await expect(call({ token: auth_token, body: { ...valid_body, file_size: 25 * 1024 * 1024 + 1 } }))
      .rejects.toMatchObject({ status: 413 })

    const video_body = { ...valid_body, file_name: 'clip.mp4', file_type: 'video/mp4', file_size: 100 * 1024 * 1024, r2_media: { kind: 'video' as const, media_id } }
    expect((await call({ token: auth_token, body: video_body })).status).toBe(200)
    await expect(call({ token: auth_token, body: { ...video_body, file_size: 100 * 1024 * 1024 + 1 } }))
      .rejects.toMatchObject({ status: 413 })
  })

  test('dev media mock points at the local /api/dev-media store when R2 is not configured', async () => {
    const response = await call({ token: await token({ id: 'u_ed', email: 'manager@example.com' }), body: valid_body })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.dev_mock).toBeTruthy()
    expect(data.object_key).toBe(`dict1/audio/${media_id}.wav`)
    expect(data.presigned_upload_url).toBe(`/api/dev-media/${data.object_key}`)
  })

  test('manager gets an R2 presigned PUT url and canonical object key', async () => {
    set_creds()
    const response = await call({ token: await token({ id: 'u_ed', email: 'manager@example.com' }), body: valid_body })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.presigned_upload_url).toBe('https://r2.example/signed-put-url')
    expect(data.bucket).toBe('livingdictionaries-media')
    expect(data.object_key).toBe(`dict1/audio/${media_id}.wav`)
    expect(data.item_id).toBe(media_id)
  })

  test('410 for stale clients using the retired folder upload shape', async () => {
    await expect(call({
      token: await token({ id: 'u_ed', email: 'manager@example.com' }),
      body: { dictionary_id: 'dict1', folder: 'dict1/images', file_name: 'cat.jpg', file_type: 'image/jpeg' },
    })).rejects.toMatchObject({ status: 410 })
  })
})
