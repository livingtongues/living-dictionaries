import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '$env/dynamic/private'
import { get_r2 } from './client'

/**
 * R2 helpers for import-resource uploads (`source_files` rows; keys under
 * `import/{dictionary_id}/{file_id}` in the private attachments bucket).
 * Downloads stream back through the gated `/api/v1/dictionaries/{id}/files/*`
 * endpoints; uploads go browser→R2 directly via a presigned PUT so a 100MB
 * PDF scan never rides through the Node body parser.
 */

export function r2_is_configured(): boolean {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ATTACHMENTS_BUCKET } = env
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ATTACHMENTS_BUCKET)
}

export async function presign_import_upload({ key, mimetype }: { key: string, mimetype: string }): Promise<string> {
  const { client, bucket } = get_r2()
  return await getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimetype,
  }), { expiresIn: 600 })
}

/** Byte count of the stored object, or null when it doesn't exist. */
export async function head_import_object({ key }: { key: string }): Promise<number | null> {
  const { client, bucket } = get_r2()
  try {
    const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return response.ContentLength ?? 0
  } catch {
    return null
  }
}

/** Idempotent — a missing key is not an error on R2. */
export async function delete_import_object({ key }: { key: string }): Promise<void> {
  const { client, bucket } = get_r2()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
