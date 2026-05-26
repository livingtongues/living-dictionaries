import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from '$env/dynamic/private'

/**
 * Upload an inbound or outbound email attachment to the
 * `livingdictionaries-attachments` R2 bucket.
 *
 * The R2 object key is the attachment's UUID (`attachment_id`), so the same
 * id can be persisted on both `message_attachments.id` and `storage_key`. A
 * future repathing migration would only have to touch `storage_key`.
 *
 * Different bucket from the snapshots one — that's public-read for viewer
 * dict snapshots; this one is admin-private (signed URLs only).
 */

let attachments_client_singleton: S3Client | null = null
let attachments_bucket_singleton: string | null = null

function get_attachments_r2(): { client: S3Client, bucket: string } {
  if (attachments_client_singleton && attachments_bucket_singleton)
    return { client: attachments_client_singleton, bucket: attachments_bucket_singleton }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ATTACHMENTS_BUCKET } = env

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ATTACHMENTS_BUCKET)
    throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ATTACHMENTS_BUCKET must be configured')

  attachments_client_singleton = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
  attachments_bucket_singleton = R2_ATTACHMENTS_BUCKET
  return { client: attachments_client_singleton, bucket: attachments_bucket_singleton }
}

export async function put_attachment({
  attachment_id,
  content,
  mimetype,
}: {
  attachment_id: string
  content: Buffer
  mimetype: string
}): Promise<void> {
  const { client, bucket } = get_attachments_r2()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: attachment_id,
    Body: content,
    ContentType: mimetype,
  }))
}
