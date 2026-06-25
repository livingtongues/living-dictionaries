import type { ChatAttachment } from '$lib/server/chat/chat-db'
import type { RequestHandler } from './$types'
import { MAX_CHAT_ATTACHMENT_BYTES, MAX_CHAT_ATTACHMENTS_PER_MESSAGE } from '$lib/admin/chat/rooms'
import { ResponseCodes } from '$lib/constants'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { add_chat_attachment } from '$lib/server/chat/chat-db'
import { put_attachment } from '$lib/r2/put-attachment'
import { error, json } from '@sveltejs/kit'
import { randomUUID } from 'node:crypto'

/**
 * Multipart upload of one-or-more attachment files for an existing chat message
 * the caller authored. Each file's bytes go into the private R2 attachments
 * bucket (object key = a fresh UUID) and a `chat_attachments` row links it to
 * the message. Mirrors the email-compose attachment path; served back through
 * the admin-authed `/api/admin/chat/attachments/[id]` route.
 */

export interface AdminChatUploadResponse {
  attachments: ChatAttachment[]
}

export const POST: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)

  let form_data: FormData
  try {
    form_data = await event.request.formData()
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, `Failed to parse multipart form: ${(err as Error).message}`)
  }

  const message_id = form_data.get('message_id')
  if (typeof message_id !== 'string' || !message_id)
    error(ResponseCodes.BAD_REQUEST, 'message_id required')

  const files = form_data.getAll('files').filter((file): file is File => file instanceof File)
  if (!files.length)
    error(ResponseCodes.BAD_REQUEST, 'No files provided')
  if (files.length > MAX_CHAT_ATTACHMENTS_PER_MESSAGE)
    error(ResponseCodes.BAD_REQUEST, `Too many files (max ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE})`)
  for (const file of files) {
    if (file.size === 0)
      error(ResponseCodes.BAD_REQUEST, `Empty file: ${file.name}`)
    if (file.size > MAX_CHAT_ATTACHMENT_BYTES)
      error(ResponseCodes.PAYLOAD_TOO_LARGE, `File too large: ${file.name}`)
  }

  try {
    const attachments: ChatAttachment[] = []
    for (const file of files) {
      const storage_key = randomUUID()
      const mimetype = file.type || 'application/octet-stream'
      const content = Buffer.from(await file.arrayBuffer())
      // Upload bytes first; only link the row once R2 has the object.
      await put_attachment({ attachment_id: storage_key, content, mimetype })
      attachments.push(add_chat_attachment({
        db,
        message_id,
        user_id,
        storage_key,
        filename: file.name || 'file',
        mimetype,
        size_bytes: content.byteLength,
      }))
    }
    return json({ attachments } satisfies AdminChatUploadResponse)
  } catch (err) {
    throw_chat_error(err)
  }
}
