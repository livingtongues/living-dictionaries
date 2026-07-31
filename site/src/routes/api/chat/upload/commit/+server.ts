import type { ChatAttachment } from '$lib/server/chat/chat-db'
import type { RequestHandler } from './$types'
import { MAX_CHAT_ATTACHMENT_BYTES, MAX_CHAT_ATTACHMENTS_PER_MESSAGE } from '$lib/chat/constants'
import { is_chat_storage_key_for_room } from '$lib/chat/storage-key'
import { ResponseCodes } from '$lib/constants'
import { head_attachment } from '$lib/r2/attachment-storage'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { add_chat_attachment, own_message_room_id } from '$lib/server/chat/chat-db'
import { error, json } from '@sveltejs/kit'

/**
 * Step 2 of the two-step chat attachment upload: now that the browser has PUT
 * the bytes straight to R2, link them to a message the caller authored.
 *
 * Two checks make this safe without a pending-upload table:
 *   1. the key must be `chat/{this message's room}/{uuid}[.ext]`, so a member
 *      can't attach some other room's object (or an email attachment) to their
 *      own message;
 *   2. HeadObject must find real bytes, and the row records THAT size — not the
 *      size the client claimed at presign time.
 *
 * A presign whose bytes never arrived therefore never becomes an attachment;
 * it's just an unreferenced object.
 */

export interface ChatUploadCommitFile {
  storage_key: string
  filename: string
  mimetype: string
}

export interface ChatUploadCommitRequestBody {
  message_id: string
  uploads: ChatUploadCommitFile[]
}

export interface ChatUploadCommitResponseBody {
  attachments: ChatAttachment[]
  /** Keys whose bytes weren't in storage — no row was created for these. */
  missing_storage_keys: string[]
}

export const POST: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)

  const { message_id, uploads } = await event.request.json() as ChatUploadCommitRequestBody

  if (!message_id?.trim())
    error(ResponseCodes.BAD_REQUEST, 'message_id required')
  if (!Array.isArray(uploads) || !uploads.length)
    error(ResponseCodes.BAD_REQUEST, 'No uploads provided')
  if (uploads.length > MAX_CHAT_ATTACHMENTS_PER_MESSAGE)
    error(ResponseCodes.BAD_REQUEST, `Too many files (max ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE})`)

  let room_id: string
  try {
    room_id = own_message_room_id({ db, message_id, user_id })
  } catch (err) {
    throw_chat_error(err)
  }

  for (const upload of uploads) {
    if (!upload?.storage_key || !is_chat_storage_key_for_room({ storage_key: upload.storage_key, room_id }))
      error(ResponseCodes.FORBIDDEN, 'storage_key does not belong to this message\'s room')
    if (!upload.filename?.trim())
      error(ResponseCodes.BAD_REQUEST, 'filename required for every upload')
  }

  try {
    const attachments: ChatAttachment[] = []
    const missing_storage_keys: string[] = []
    for (const upload of uploads) {
      const head = await head_attachment({ key: upload.storage_key })
      if (!head) {
        missing_storage_keys.push(upload.storage_key)
        continue
      }
      if (head.size_bytes > MAX_CHAT_ATTACHMENT_BYTES)
        error(ResponseCodes.PAYLOAD_TOO_LARGE, `"${upload.filename}" exceeds the ${Math.round(MAX_CHAT_ATTACHMENT_BYTES / 1024 / 1024)}MB limit`)
      attachments.push(add_chat_attachment({
        db,
        message_id,
        user_id,
        storage_key: upload.storage_key,
        filename: upload.filename,
        mimetype: upload.mimetype?.trim() || 'application/octet-stream',
        size_bytes: head.size_bytes,
      }))
    }
    return json({ attachments, missing_storage_keys } satisfies ChatUploadCommitResponseBody)
  } catch (err) {
    throw_chat_error(err)
  }
}
