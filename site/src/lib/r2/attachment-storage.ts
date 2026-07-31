import { GetObjectCommand, HeadObjectCommand, NoSuchKey, NotFound, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { get_r2, r2_attachments_is_configured } from './client'
import { dev_media_size, read_dev_media } from '$lib/server/dev-media-dir'

/**
 * Storage operations for the private attachments bucket that the presigned
 * upload flow needs: mint an upload URL, confirm bytes landed, and read a byte
 * RANGE back out for media playback.
 *
 * Every function falls back to the `<DATA_DIR>/dev-media` store when R2 isn't
 * configured, so local dev can upload a 200 MB video, seek around in it, and
 * exercise the same code paths as prod without credentials.
 */

export class AttachmentNotFound extends Error {
  constructor(key: string) {
    super(`Attachment object missing: ${key}`)
    this.name = 'AttachmentNotFound'
  }
}

/**
 * A URL the browser can PUT bytes to directly.
 *
 * `ContentLength` is part of the signature, so the client can't presign a small
 * file and then upload a huge one — R2 rejects any PUT whose length differs
 * from what was signed. That's what makes the size check at presign binding
 * rather than advisory.
 */
export async function presign_attachment_upload({ storage_key, mimetype, size_bytes, expires_in_seconds }: {
  storage_key: string
  mimetype: string
  size_bytes: number
  expires_in_seconds: number
}): Promise<{ upload_url: string, dev_mock: boolean }> {
  if (!r2_attachments_is_configured()) {
    if (import.meta.env.DEV)
      return { upload_url: `/api/dev-media/${storage_key}`, dev_mock: true }
    throw new Error('Attachment storage is not configured')
  }

  const { client, bucket } = get_r2()
  const upload_url = await getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket,
    Key: storage_key,
    ContentType: mimetype,
    ContentLength: size_bytes,
  }), { expiresIn: expires_in_seconds })
  return { upload_url, dev_mock: false }
}

/**
 * True byte size of a stored object, or null when it isn't there. Commit uses
 * this both to reject presigns that never uploaded and to record the real size
 * rather than the size the client claimed.
 */
export async function head_attachment({ key }: { key: string }): Promise<{ size_bytes: number } | null> {
  if (!r2_attachments_is_configured()) {
    if (!import.meta.env.DEV)
      throw new Error('Attachment storage is not configured')
    const size_bytes = dev_media_size({ key })
    return size_bytes === null ? null : { size_bytes }
  }

  const { client, bucket } = get_r2()
  try {
    const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return { size_bytes: response.ContentLength ?? 0 }
  } catch (err) {
    if (err instanceof NotFound || err instanceof NoSuchKey || (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404)
      return null
    throw err
  }
}

export interface AttachmentBytes {
  body: ReadableStream<Uint8Array>
  /** Bytes in THIS response (the range length for a partial read). */
  content_length: number
  /** Bytes in the whole object. */
  total_size: number
}

/**
 * Read an object, optionally a single byte range. `range` is inclusive on both
 * ends, matching both the HTTP header and S3's `Range` parameter.
 */
export async function get_attachment_bytes({ key, range }: { key: string, range?: { start: number, end: number } }): Promise<AttachmentBytes> {
  if (!r2_attachments_is_configured()) {
    if (!import.meta.env.DEV)
      throw new Error('Attachment storage is not configured')
    const buffer = read_dev_media({ key })
    if (!buffer)
      throw new AttachmentNotFound(key)
    const total_size = buffer.byteLength
    const slice = new Uint8Array(range ? buffer.subarray(range.start, range.end + 1) : buffer)
    return {
      body: new Blob([slice]).stream() as ReadableStream<Uint8Array>,
      content_length: slice.byteLength,
      total_size,
    }
  }

  const { client, bucket } = get_r2()
  try {
    const response = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: range ? `bytes=${range.start}-${range.end}` : undefined,
    }))
    if (!response.Body)
      throw new AttachmentNotFound(key)
    // `ContentRange` looks like `bytes 200-499/1000`; the tail is the full size.
    const total_size = response.ContentRange
      ? Number(response.ContentRange.split('/').pop())
      : response.ContentLength ?? 0
    return {
      body: response.Body.transformToWebStream(),
      content_length: response.ContentLength ?? 0,
      total_size: Number.isFinite(total_size) ? total_size : response.ContentLength ?? 0,
    }
  } catch (err) {
    if (err instanceof NoSuchKey || err instanceof NotFound)
      throw new AttachmentNotFound(key)
    throw err
  }
}
