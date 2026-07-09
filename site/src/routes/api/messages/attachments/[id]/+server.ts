import type { RequestHandler } from './$types'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { get_attachment_stream, R2AttachmentNotFound } from '$lib/r2/get-attachment'
import { error } from '@sveltejs/kit'

/**
 * Admin-authed binary stream of an inbound-message attachment. Looks up the
 * `message_attachments` row by `id`, resolves `storage_key` to its R2 object
 * key, fetches it, and streams the response back with proper `Content-Type` +
 * `Content-Disposition` headers. Images serve `inline` so the admin thread
 * viewer can render them as thumbnails; other files serve `attachment` so the
 * filename link downloads. Mirrors house's `/api/messages/attachments/[id]`.
 */

interface AttachmentRow {
  filename: string
  mimetype: string
  storage_key: string
  size_bytes: number
  disposition: 'attachment' | 'inline'
}

export const GET: RequestHandler = async (event) => {
  const { email } = await verify_auth(event)
  if (!is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const attachment_id = event.params.id
  if (!attachment_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing attachment id')

  const db = get_shared_db()
  const row = db.prepare(
    `SELECT filename, mimetype, storage_key, size_bytes, disposition
     FROM message_attachments WHERE id = ?`,
  ).get(attachment_id) as AttachmentRow | undefined
  if (!row)
    error(ResponseCodes.NOT_FOUND, 'Attachment not found')

  let stream: { body: ReadableStream<Uint8Array>, content_length: number }
  try {
    stream = await get_attachment_stream({ key: row.storage_key })
  } catch (err) {
    if (err instanceof R2AttachmentNotFound)
      error(ResponseCodes.NOT_FOUND, 'Attachment blob missing from R2')
    throw err
  }

  const mimetype = row.mimetype || 'application/octet-stream'
  const content_length = stream.content_length || row.size_bytes
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
