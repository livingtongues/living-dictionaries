import { GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3'
import { get_r2 } from './client'

export class R2AttachmentNotFound extends Error {
  constructor(key: string) {
    super(`R2 object missing: ${key}`)
    this.name = 'R2AttachmentNotFound'
  }
}

/**
 * Fetches an attachment blob from R2 and returns its web stream.
 *
 * Caller is responsible for wiring `body` straight into a Response, and for
 * setting `Content-Type` / `Content-Disposition` headers from the row data
 * (we trust the DB's stored mimetype + filename over R2's metadata so a
 * mis-uploaded object can still be served with the right content-type).
 *
 * Throws `R2AttachmentNotFound` when the key doesn't exist (the caller maps
 * this to a 404 on the HTTP endpoint).
 */
export async function get_attachment_stream({ key }: { key: string }): Promise<{
  body: ReadableStream<Uint8Array>
  content_length: number
}> {
  const { client, bucket } = get_r2()
  try {
    const response = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }))
    if (!response.Body)
      throw new R2AttachmentNotFound(key)
    return {
      body: response.Body.transformToWebStream(),
      content_length: response.ContentLength ?? 0,
    }
  } catch (error) {
    if (error instanceof NoSuchKey)
      throw new R2AttachmentNotFound(key)
    throw error
  }
}
