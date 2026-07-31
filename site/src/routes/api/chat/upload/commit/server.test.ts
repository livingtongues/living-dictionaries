import type { ChatUploadCommitResponseBody } from './+server'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { MAX_CHAT_ATTACHMENT_BYTES } from '$lib/chat/constants'
import { build_chat_storage_key } from '$lib/chat/storage-key'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { post_message } from '$lib/server/chat/chat-db'
import { write_dev_media } from '$lib/server/dev-media-dir'
import { make_cookies, PARTNER, seed_chat_users, seed_rooms, STRANGER, SUPER_ADMIN, token_for } from '../../_test-helpers'
import { POST } from './+server'

let db: ReturnType<typeof open_test_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

// Unconfigured R2 → the storage layer reads the local dev-media dir, so
// "did the bytes actually land" is a real filesystem check in these tests.
vi.mock('$lib/r2/client', async () => {
  const actual = await vi.importActual<typeof import('$lib/r2/client')>('$lib/r2/client')
  return { ...actual, r2_attachments_is_configured: () => false }
})

let data_dir: string
let previous_data_dir: string | undefined

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

let regular_id: string

beforeEach(() => {
  db = open_test_shared_db()
  seed_chat_users(db)
  ;({ regular_id } = seed_rooms(db))
  previous_data_dir = process.env.DATA_DIR
  data_dir = mkdtempSync(join(tmpdir(), 'ld-chat-commit-'))
  process.env.DATA_DIR = data_dir
})

afterEach(() => {
  db.close()
  if (previous_data_dir === undefined)
    delete process.env.DATA_DIR
  else
    process.env.DATA_DIR = previous_data_dir
  rmSync(data_dir, { recursive: true, force: true })
})

function call(options: { token?: string, message_id: string, uploads: { storage_key: string, filename: string, mimetype: string }[] }) {
  const request = new Request('http://localhost/api/chat/upload/commit', {
    method: 'POST',
    body: JSON.stringify({ message_id: options.message_id, uploads: options.uploads }),
    headers: { 'content-type': 'application/json' },
  })
  return POST({ request, cookies: make_cookies(options.token) } as unknown as Parameters<typeof POST>[0])
}

function message_from(user_id: string) {
  return post_message({ db, room_id: regular_id, user_id, body_html: '<p>here it is</p>', body_text: 'here it is' })
}

/** Stand in for a completed presigned PUT: an object at a room-scoped key. */
function upload_bytes({ filename, bytes = 'video-bytes', room_id = regular_id }: { filename: string, bytes?: string, room_id?: string }) {
  const storage_key = build_chat_storage_key({ room_id, upload_id: crypto.randomUUID(), filename })
  write_dev_media({ key: storage_key, content: bytes })
  return { storage_key, filename, mimetype: 'video/mp4' }
}

describe(POST, () => {
  test('401 without auth', async () => {
    const message = message_from(PARTNER.user_id)
    await expect(call({ message_id: message.id, uploads: [upload_bytes({ filename: 'a.mp4' })] }))
      .rejects.toMatchObject({ status: 401 })
  })

  test('403 for a non-chat-member', async () => {
    const message = message_from(PARTNER.user_id)
    await expect(call({ token: await token_for(STRANGER), message_id: message.id, uploads: [upload_bytes({ filename: 'a.mp4' })] }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('403 when committing onto someone else\'s message', async () => {
    const message = message_from(SUPER_ADMIN.user_id)
    await expect(call({ token: await token_for(PARTNER), message_id: message.id, uploads: [upload_bytes({ filename: 'a.mp4' })] }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('403 for a key belonging to a DIFFERENT room', async () => {
    const message = message_from(PARTNER.user_id)
    const foreign = upload_bytes({ filename: 'a.mp4', room_id: 'some-other-room' })
    await expect(call({ token: await token_for(PARTNER), message_id: message.id, uploads: [foreign] }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('403 for an arbitrary/legacy bare-uuid key', async () => {
    const message = message_from(PARTNER.user_id)
    write_dev_media({ key: 'a-legacy-email-attachment', content: 'secret' })
    await expect(call({ token: await token_for(PARTNER), message_id: message.id, uploads: [{ storage_key: 'a-legacy-email-attachment', filename: 'x.pdf', mimetype: 'application/pdf' }] }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('404 for an unknown message', async () => {
    await expect(call({ token: await token_for(PARTNER), message_id: 'nope', uploads: [upload_bytes({ filename: 'a.mp4' })] }))
      .rejects.toMatchObject({ status: 404 })
  })

  test('commits the row with the TRUE byte size, not a claimed one', async () => {
    const message = message_from(PARTNER.user_id)
    const upload = upload_bytes({ filename: 'clip.mp4', bytes: 'exactly-21-bytes-here' })

    const response = await call({ token: await token_for(PARTNER), message_id: message.id, uploads: [upload] })
    expect(response.status).toBe(200)
    const { attachments, missing_storage_keys } = await response.json() as ChatUploadCommitResponseBody
    expect(missing_storage_keys).toEqual([])
    expect(attachments).toHaveLength(1)
    expect(attachments[0].size_bytes).toBe(21)
    expect(attachments[0].filename).toBe('clip.mp4')

    const row = db.prepare('SELECT message_id, storage_key, mimetype, size_bytes FROM chat_attachments WHERE id = ?').get(attachments[0].id)
    expect(row).toEqual({ message_id: message.id, storage_key: upload.storage_key, mimetype: 'video/mp4', size_bytes: 21 })
  })

  test('a presigned key whose bytes never landed creates NO row', async () => {
    const message = message_from(PARTNER.user_id)
    const never_uploaded = { storage_key: build_chat_storage_key({ room_id: regular_id, upload_id: crypto.randomUUID(), filename: 'ghost.mp4' }), filename: 'ghost.mp4', mimetype: 'video/mp4' }

    const response = await call({ token: await token_for(PARTNER), message_id: message.id, uploads: [never_uploaded] })
    const body = await response.json() as ChatUploadCommitResponseBody
    expect(body.attachments).toEqual([])
    expect(body.missing_storage_keys).toEqual([never_uploaded.storage_key])
    expect(db.prepare('SELECT COUNT(*) AS count FROM chat_attachments').get()).toEqual({ count: 0 })
  })

  test('commits the landed files and skips the missing one in a mixed batch', async () => {
    const message = message_from(PARTNER.user_id)
    const landed = upload_bytes({ filename: 'clip.mp4' })
    const ghost = { storage_key: build_chat_storage_key({ room_id: regular_id, upload_id: crypto.randomUUID(), filename: 'ghost.pdf' }), filename: 'ghost.pdf', mimetype: 'application/pdf' }

    const response = await call({ token: await token_for(PARTNER), message_id: message.id, uploads: [landed, ghost] })
    const body = await response.json() as ChatUploadCommitResponseBody
    expect(body.attachments.map(attachment => attachment.filename)).toEqual(['clip.mp4'])
    expect(body.missing_storage_keys).toEqual([ghost.storage_key])
  })

  test('413 when the stored object is over the ceiling despite what was presigned', async () => {
    const message = message_from(PARTNER.user_id)
    const upload = upload_bytes({ filename: 'huge.mp4', bytes: 'x'.repeat(64) })
    vi.spyOn(await import('$lib/r2/attachment-storage'), 'head_attachment')
      .mockResolvedValueOnce({ size_bytes: MAX_CHAT_ATTACHMENT_BYTES + 1 })

    await expect(call({ token: await token_for(PARTNER), message_id: message.id, uploads: [upload] }))
      .rejects.toMatchObject({ status: 413 })
    expect(db.prepare('SELECT COUNT(*) AS count FROM chat_attachments').get()).toEqual({ count: 0 })
  })

  test('400 on a missing message_id or an empty upload list', async () => {
    const token = await token_for(PARTNER)
    await expect(call({ token, message_id: '', uploads: [upload_bytes({ filename: 'a.mp4' })] })).rejects.toMatchObject({ status: 400 })
    await expect(call({ token, message_id: 'whatever', uploads: [] })).rejects.toMatchObject({ status: 400 })
  })
})
