import type { RequestHandler } from './$types'
import { is_inline_safe_mimetype } from '$lib/chat/attachments'
import { ResponseCodes } from '$lib/constants'
import { AttachmentNotFound, get_attachment_bytes, head_attachment } from '$lib/r2/attachment-storage'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { get_chat_attachment_for_serve } from '$lib/server/chat/chat-db'
import { content_range_header, parse_range_header } from '$lib/utils/http-range'
import { error } from '@sveltejs/kit'

/**
 * Membership-gated binary stream of a chat attachment. Looks up the
 * `chat_attachments` row by `id` (gated on the caller's membership of the
 * attachment's room), resolves `storage_key` to the stored object, and streams
 * it back.
 *
 * **Range requests are honoured** (206 + `Content-Range`): `<video>` and
 * `<audio>` can't seek without it, and Safari won't play a media URL at all
 * unless the server advertises `Accept-Ranges`. The range is passed straight
 * through to R2, so scrubbing a 500 MB recording never pulls more than the
 * requested window through this process.
 *
 * Disposition is `inline` only for types that are safe to render from our own
 * origin (`is_inline_safe_mimetype` — notably NOT SVG, which would be stored
 * XSS); everything else downloads.
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

  const mimetype = row.mimetype || 'application/octet-stream'
  const safe_filename = encodeURIComponent(row.filename)
  const disposition = is_inline_safe_mimetype(mimetype) ? 'inline' : 'attachment'
  const range_header = event.request.headers.get('range')

  // Rows written before the presigned-upload flow can have a null size_bytes,
  // and a range can't be resolved without knowing the total — HEAD for it.
  let total_size = row.size_bytes ?? 0
  if (range_header && !total_size) {
    const head = await head_attachment({ key: row.storage_key })
    if (!head)
      error(ResponseCodes.NOT_FOUND, 'Attachment blob missing from storage')
    total_size = head.size_bytes
  }

  const range = parse_range_header({ range: range_header, total_size })
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: ResponseCodes.RANGE_NOT_SATISFIABLE,
      headers: { 'Content-Range': `bytes */${total_size}`, 'Accept-Ranges': 'bytes' },
    })
  }

  let bytes: Awaited<ReturnType<typeof get_attachment_bytes>>
  try {
    bytes = await get_attachment_bytes({ key: row.storage_key, range: range ?? undefined })
  } catch (err) {
    if (err instanceof AttachmentNotFound)
      error(ResponseCodes.NOT_FOUND, 'Attachment blob missing from storage')
    throw err
  }

  const headers: Record<string, string> = {
    'Content-Type': mimetype,
    'Content-Length': String(bytes.content_length),
    'Content-Disposition': `${disposition}; filename="${safe_filename}"`,
    'Cache-Control': 'private, max-age=3600',
    'Accept-Ranges': 'bytes',
  }
  if (range)
    headers['Content-Range'] = content_range_header({ range, total_size: bytes.total_size || total_size })

  return new Response(bytes.body, {
    status: range ? ResponseCodes.PARTIAL_CONTENT : ResponseCodes.OK,
    headers,
  })
}
