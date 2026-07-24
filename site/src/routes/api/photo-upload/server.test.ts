import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Database } from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { store_media_bytes } from '$lib/server/media-storage'
import { store_photo_variants_in_background } from '$lib/server/photo-variants'
import { POST } from './+server'

let db: Database

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

vi.mock('$lib/server/media-storage', async (orig) => {
  const actual = await orig<typeof import('$lib/server/media-storage')>()
  return {
    ...actual,
    store_media_bytes: vi.fn(({ r2_key }: { r2_key: string }) => Promise.resolve({ storage_path: r2_key, bucket: 'bucket', dev_mock: false })),
  }
})

vi.mock('$lib/server/photo-variants', () => ({
  store_photo_variants_in_background: vi.fn(),
}))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  vi.clearAllMocks()
  db = open_test_shared_db()
  const now = '2026-01-01T00:00:00Z'
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u_con', 'contributor@example.com', 'Contributor', JSON.stringify([]), now, now)
  db.prepare(`INSERT INTO dictionaries (id, url, name, entry_count, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`)
    .run('dict1', 'dict1', 'Dict One', now, now)
  db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('r_con', 'dict1', 'u_con', 'contributor', now, now)
})

afterEach(() => db.close())

const PHOTO_ID = '48af49b0-b410-4db1-babf-38ac53269e62'
const JPEG_BYTES = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])
const HEIC_BYTES = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]) // ftyp heic
// Real 64px JPEG carrying EXIF GPS (43.4674, 11.8851) + DateTimeOriginal 2008-10-22.
const GPS_JPEG = readFileSync(join(__dirname, 'fixtures/gps-sample.jpg'))

async function call({ file, fields = {} }: { file: File, fields?: Record<string, string> }) {
  const form = new FormData()
  form.set('dictionary_id', 'dict1')
  form.set('photo_id', PHOTO_ID)
  form.set('file', file)
  for (const [key, value] of Object.entries(fields))
    form.set(key, value)
  const request = new Request('http://localhost/api/photo-upload', { method: 'POST', body: form })
  const token = await sign_jwt({ sub: 'u_con', email: 'contributor@example.com', name: 'Contributor' })
  const cookies = { get: (name: string) => (name === 'session' ? token : undefined) }
  return POST({ request, cookies } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('stores a JPEG on the R2 key + fires variant generation', async () => {
    const response = await call({ file: new File([JPEG_BYTES], 'pic.jpg', { type: 'image/jpeg' }) })
    const body = await response.json()
    expect(body.storage_path).toBe(`dict1/photo/${PHOTO_ID}.jpg`)
    expect(store_photo_variants_in_background).toHaveBeenCalled()
    expect(db.prepare(`SELECT bytes FROM media_objects WHERE key = ?`).get(body.storage_path)).toEqual({ bytes: JPEG_BYTES.length })
  })

  test('client EXIF fields are blunted to village level (2dp) and echoed back', async () => {
    const response = await call({
      file: new File([JPEG_BYTES], 'pic.jpg', { type: 'image/jpeg' }),
      fields: { latitude: '19.318472', longitude: '-98.23751', taken_at: '2023-05-01T10:00:00Z' },
    })
    const body = await response.json()
    expect(body.latitude).toBe(19.32)
    expect(body.longitude).toBe(-98.24)
    expect(body.taken_at).toBe('2023-05-01T10:00:00.000Z')
  })

  test('server reads EXIF GPS + capture time from the bytes when the client sends no fields', async () => {
    const response = await call({ file: new File([GPS_JPEG], 'gps.jpg', { type: 'image/jpeg' }) })
    const body = await response.json()
    expect(body.latitude).toBe(43.47)
    expect(body.longitude).toBe(11.89)
    expect(body.taken_at).toBe('2008-10-22T16:28:39.000Z')
  })

  test('undecodable HEIC → 415 with a user-facing conversion message (no broken original stored)', async () => {
    // Magic-sniffed as HEIC but sharp can't decode 12 bytes → the transcode net rejects.
    await expect(call({ file: new File([HEIC_BYTES], 'pic.heic', { type: 'image/heic' }) }))
      .rejects.toMatchObject({ status: 415 })
    expect(store_media_bytes).not.toHaveBeenCalled()
  })

  test('non-image bytes → 415 even with an image content-type', async () => {
    const html = new TextEncoder().encode('<!DOCTYPE html><html><body>nope</body></html>')
    await expect(call({ file: new File([html], 'pic.jpg', { type: 'image/jpeg' }) }))
      .rejects.toMatchObject({ status: 415 })
    expect(store_media_bytes).not.toHaveBeenCalled()
  })
})
