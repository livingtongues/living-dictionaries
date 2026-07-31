import type { RequestHandler } from './$types'
import { CHAT_UPLOAD_URL_TTL_SECONDS, MAX_CHAT_ATTACHMENT_BYTES, MAX_CHAT_ATTACHMENTS_PER_MESSAGE } from '$lib/chat/constants'
import { build_chat_storage_key } from '$lib/chat/storage-key'
import { ResponseCodes } from '$lib/constants'
import { presign_attachment_upload } from '$lib/r2/attachment-storage'
import { r2_attachments_is_configured } from '$lib/r2/client'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { is_member } from '$lib/server/chat/chat-db'
import { error, json } from '@sveltejs/kit'
import { randomUUID } from 'node:crypto'

/**
 * Step 1 of the two-step chat attachment upload: hand the browser a presigned
 * PUT URL per file so the bytes go **straight to R2**, never through this
 * server. That's what lets a 500 MB screen recording be an attachment at all —
 * adapter-node's `BODY_SIZE_LIMIT` is 105 MB and the old multipart endpoint
 * buffered whole files into heap on a 2-vCPU box.
 *
 * Nothing is recorded here. An upload that is presigned but never PUT (or never
 * committed) leaves no row and no trace beyond an unreferenced object; only
 * `/api/chat/upload/commit` creates `chat_attachments`.
 */

export interface ChatUploadPresignFile {
  filename: string
  mimetype: string
  size_bytes: number
}

export interface ChatUploadPresignRequestBody {
  room_id: string
  files: ChatUploadPresignFile[]
}

export interface ChatUploadPresignedFile {
  storage_key: string
  upload_url: string
  filename: string
  mimetype: string
  /** DEV-only: `upload_url` points at the local `/api/dev-media` store, not R2. */
  dev_mock?: boolean
}

export interface ChatUploadPresignResponseBody {
  uploads: ChatUploadPresignedFile[]
}

export const POST: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)

  const { room_id, files } = await event.request.json() as ChatUploadPresignRequestBody

  if (!room_id?.trim())
    error(ResponseCodes.BAD_REQUEST, 'room_id required')
  if (!Array.isArray(files) || !files.length)
    error(ResponseCodes.BAD_REQUEST, 'No files provided')
  if (files.length > MAX_CHAT_ATTACHMENTS_PER_MESSAGE)
    error(ResponseCodes.BAD_REQUEST, `Too many files (max ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE})`)

  // gate_chat only proves the caller is a chat member SOMEWHERE; uploading into
  // a specific room requires membership of THAT room.
  if (!is_member({ db, room_id, user_id }))
    error(ResponseCodes.FORBIDDEN, 'Not a member of this room')

  for (const file of files) {
    if (!file?.filename?.trim())
      error(ResponseCodes.BAD_REQUEST, 'filename required for every file')
    if (!Number.isSafeInteger(file.size_bytes) || file.size_bytes <= 0)
      error(ResponseCodes.BAD_REQUEST, `size_bytes must be a positive integer: ${file.filename}`)
    if (file.size_bytes > MAX_CHAT_ATTACHMENT_BYTES)
      error(ResponseCodes.PAYLOAD_TOO_LARGE, `"${file.filename}" exceeds the ${Math.round(MAX_CHAT_ATTACHMENT_BYTES / 1024 / 1024)}MB limit`)
  }

  if (!r2_attachments_is_configured() && !import.meta.env.DEV)
    error(ResponseCodes.SERVICE_UNAVAILABLE, 'Attachment uploads are not configured (missing R2 credentials)')

  try {
    const uploads: ChatUploadPresignedFile[] = []
    for (const file of files) {
      const mimetype = file.mimetype?.trim() || 'application/octet-stream'
      const storage_key = build_chat_storage_key({ room_id, upload_id: randomUUID(), filename: file.filename })
      const { upload_url, dev_mock } = await presign_attachment_upload({
        storage_key,
        mimetype,
        size_bytes: file.size_bytes,
        expires_in_seconds: CHAT_UPLOAD_URL_TTL_SECONDS,
      })
      uploads.push({ storage_key, upload_url, filename: file.filename, mimetype, ...(dev_mock ? { dev_mock } : {}) })
    }
    return json({ uploads } satisfies ChatUploadPresignResponseBody)
  } catch (err) {
    throw_chat_error(err)
  }
}
