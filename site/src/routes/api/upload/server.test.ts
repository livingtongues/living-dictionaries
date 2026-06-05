import type { Database } from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_shared_db } from '$lib/db/server/shared-db'
import { reset_gcs_client } from '$lib/server/gcloud'
import { POST } from './+server'

let db: Database

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://storage.googleapis.com/signed-put-url'),
}))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_shared_db(':memory:')
  const now = '2026-01-01T00:00:00Z'
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u_ed', 'editor@example.com', 'Editor', JSON.stringify([]), now, now)
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u_con', 'contributor@example.com', 'Contributor', JSON.stringify([]), now, now)
  db.prepare(`INSERT INTO dictionaries (id, url, name, entry_count, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`)
    .run('dict1', 'dict1', 'Dict One', now, now)
  db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('r_ed', 'dict1', 'u_ed', 'editor', now, now)
  db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('r_con', 'dict1', 'u_con', 'contributor', now, now)

  reset_gcs_client()
  delete process.env.GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID
  delete process.env.GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY
})

afterEach(() => db.close())

function token(user: { id: string, email: string }) {
  return sign_jwt({ sub: user.id, email: user.email, name: user.email })
}

const valid_body = { folder: 'dict1/images', dictionary_id: 'dict1', file_name: 'cat.jpg', file_type: 'image/jpeg' }

function set_creds() {
  process.env.GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID = 'test-key'
  process.env.GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY = 'test-secret'
  reset_gcs_client()
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

  test('403 for a contributor (below editor)', async () => {
    await expect(call({ token: await token({ id: 'u_con', email: 'contributor@example.com' }), body: valid_body }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('400 when dictionary_id missing', async () => {
    await expect(call({ token: await token({ id: 'u_ed', email: 'editor@example.com' }), body: { ...valid_body, dictionary_id: '' } }))
      .rejects.toMatchObject({ status: 400 })
  })

  test('400 when file_name missing', async () => {
    await expect(call({ token: await token({ id: 'u_ed', email: 'editor@example.com' }), body: { ...valid_body, file_name: '' } }))
      .rejects.toMatchObject({ status: 400 })
  })

  test('dev media mock (200) when GCS not configured — points at the local /api/dev-media store', async () => {
    const response = await call({ token: await token({ id: 'u_ed', email: 'editor@example.com' }), body: valid_body })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.dev_mock).toBeTruthy()
    expect(data.object_key).toMatch(/^dict1\/images\/\d+\.jpg$/)
    expect(data.presigned_upload_url).toBe(`/api/dev-media/${data.object_key}`)
  })

  test('editor gets a presigned PUT url + object_key', async () => {
    set_creds()
    const response = await call({ token: await token({ id: 'u_ed', email: 'editor@example.com' }), body: valid_body })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.presigned_upload_url).toBe('https://storage.googleapis.com/signed-put-url')
    expect(['talking-dictionaries-dev.appspot.com', 'talking-dictionaries-alpha.appspot.com']).toContain(data.bucket)
    expect(data.object_key).toMatch(/^dict1\/images\/\d+\.jpg$/)
    expect(data.item_id).toMatch(/^\d+$/)
  })
})
