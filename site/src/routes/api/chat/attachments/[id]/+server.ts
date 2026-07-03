import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_attachment_stream, R2AttachmentNotFound } from '$lib/r2/get-attachment'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { get_chat_attachment_for_serve } from '$lib/server/chat/chat-db'
import { error } from '@sveltejs/kit'

/**
 * Membership-gated binary stream of a chat attachment. Looks up the
 * `chat_attachments` row by `id` (gated on the caller's membership of the
 * attachment's room), resolves `storage_key` to the R2 object, and streams it
 * back. Images serve `inline` so the message thumbnail renders in place; other
 * files serve `attachment` so the filename link downloads. Mirrors
 * `/api/messages/attachments/[id]`.
 */
export const GET: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)

  const attachment_id = event.params.id
  if (!attachment_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing attachment id')

  let row: ReturnType<typeof get_chat_attachment_for_serve>
  try {
    row = get_chat_attachment_for_serve({ db, attachment_id, user_id })
  } catch (err) {
    throw_chat_error(err)
  }

  let stream: { body: ReadableStream<Uint8Array>, content_length: number }
  try {
    stream = await get_attachment_stream({ key: row.storage_key })
  } catch (err) {
    if (err instanceof R2AttachmentNotFound)
      error(ResponseCodes.NOT_FOUND, 'Attachment blob missing from R2')
    throw err
  }

  const mimetype = row.mimetype || 'application/octet-stream'
  const content_length = stream.content_length || row.size_bytes || 0
  const safe_filename = encodeURIComponent(row.filename)
  const disposition = mimetype.startsWith('image/') ? 'inline' : 'attachment'

  return new Response(stream.body, {
    status: 200,
    headers: {
      'Content-Type': mimetype,
      'Content-Length': String(content_length),
      'Content-Disposition': `${disposition}; filename="${safe_filename}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
