import type { ChatUploadPresignResponseBody } from './+server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { MAX_CHAT_ATTACHMENT_BYTES, MAX_CHAT_ATTACHMENTS_PER_MESSAGE } from '$lib/chat/constants'
import { is_chat_storage_key_for_room } from '$lib/chat/storage-key'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { make_cookies, PARTNER, seed_chat_users, seed_rooms, STRANGER, SUPER_ADMIN, token_for } from '../../_test-helpers'
import { POST } from './+server'

let db: ReturnType<typeof open_test_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

// No R2 credentials in tests, so presigning takes the dev-media branch and
// returns a local PUT URL — the shape under test is the same either way.
vi.mock('$lib/r2/client', async () => {
  const actual = await vi.importActual<typeof import('$lib/r2/client')>('$lib/r2/client')
  return { ...actual, r2_attachments_is_configured: () => false }
})

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

let regular_id: string
let admin_room_id: string

beforeEach(() => {
  db = open_test_shared_db()
  seed_chat_users(db)
  ;({ regular_id, admin_room_id } = seed_rooms(db))
})

afterEach(() => {
  db.close()
})

function call(options: { token?: string, room_id: string, files: { filename: string, mimetype: string, size_bytes: number }[] }) {
  const request = new Request('http://localhost/api/chat/upload/presign', {
    method: 'POST',
    body: JSON.stringify({ room_id: options.room_id, files: options.files }),
    headers: { 'content-type': 'application/json' },
  })
  return POST({ request, cookies: make_cookies(options.token) } as unknown as Parameters<typeof POST>[0])
}

const video = { filename: '2026-07-31-combined.mp4', mimetype: 'video/mp4', size_bytes: 172_000_000 }

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ room_id: regular_id, files: [video] })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for someone with no chat access at all', async () => {
    await expect(call({ token: await token_for(STRANGER), room_id: regular_id, files: [video] }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('403 for a chat member who is not in THIS room', async () => {
    // The partner is a chat member (of the regular room) but not of the admin room.
    await expect(call({ token: await token_for(PARTNER), room_id: admin_room_id, files: [video] }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('presigns a room-scoped key for a 172 MB video', async () => {
    const response = await call({ token: await token_for(PARTNER), room_id: regular_id, files: [video] })
    expect(response.status).toBe(200)
    const { uploads } = await response.json() as ChatUploadPresignResponseBody
    expect(uploads).toHaveLength(1)
    expect(is_chat_storage_key_for_room({ storage_key: uploads[0].storage_key, room_id: regular_id })).toBeTruthy()
    expect(uploads[0].storage_key.endsWith('.mp4')).toBeTruthy()
    expect(uploads[0].mimetype).toBe('video/mp4')
    expect(uploads[0].upload_url).toBe(`/api/dev-media/${uploads[0].storage_key}`)
  })

  test('mints a distinct key per file in a batch', async () => {
    const response = await call({
      token: await token_for(SUPER_ADMIN),
      room_id: regular_id,
      files: [video, { filename: 'tree.jpg', mimetype: 'image/jpeg', size_bytes: 2_100_000 }],
    })
    const { uploads } = await response.json() as ChatUploadPresignResponseBody
    expect(new Set(uploads.map(upload => upload.storage_key)).size).toBe(2)
  })

  test('defaults a missing mimetype rather than rejecting the file', async () => {
    const response = await call({ token: await token_for(PARTNER), room_id: regular_id, files: [{ filename: 'notes', mimetype: '', size_bytes: 12 }] })
    const { uploads } = await response.json() as ChatUploadPresignResponseBody
    expect(uploads[0].mimetype).toBe('application/octet-stream')
  })

  test('413 over the per-file ceiling', async () => {
    await expect(call({ token: await token_for(PARTNER), room_id: regular_id, files: [{ ...video, size_bytes: MAX_CHAT_ATTACHMENT_BYTES + 1 }] }))
      .rejects.toMatchObject({ status: 413 })
  })

  test('accepts a file exactly at the ceiling', async () => {
    const response = await call({ token: await token_for(PARTNER), room_id: regular_id, files: [{ ...video, size_bytes: MAX_CHAT_ATTACHMENT_BYTES }] })
    expect(response.status).toBe(200)
  })

  test('400 on no files, too many files, a zero-byte file, and a missing room', async () => {
    const token = await token_for(PARTNER)
    await expect(call({ token, room_id: regular_id, files: [] })).rejects.toMatchObject({ status: 400 })
    await expect(call({ token, room_id: regular_id, files: Array.from({ length: MAX_CHAT_ATTACHMENTS_PER_MESSAGE + 1 }, () => video) }))
      .rejects.toMatchObject({ status: 400 })
    await expect(call({ token, room_id: regular_id, files: [{ ...video, size_bytes: 0 }] })).rejects.toMatchObject({ status: 400 })
    await expect(call({ token, room_id: '', files: [video] })).rejects.toMatchObject({ status: 400 })
  })

  test('writes nothing — a presign that is never uploaded leaves no trace', async () => {
    await call({ token: await token_for(PARTNER), room_id: regular_id, files: [video] })
    expect(db.prepare('SELECT COUNT(*) AS count FROM chat_attachments').get()).toEqual({ count: 0 })
  })
})
