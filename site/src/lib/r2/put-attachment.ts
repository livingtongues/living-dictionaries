import { PutObjectCommand } from '@aws-sdk/client-s3'
import { get_r2 } from './client'

/**
 * Upload an inbound or outbound email attachment to the attachments R2 bucket
 * (`get_r2`, private). The R2 object key is the attachment's UUID
 * (`attachment_id`), so the same id can be persisted on both
 * `message_attachments.id` and `storage_key`. A future repathing migration
 * would only have to touch `storage_key`.
 */
export async function put_attachment({
  attachment_id,
  content,
  mimetype,
}: {
  attachment_id: string
  content: Buffer
  mimetype: string
}): Promise<void> {
  const { client, bucket } = get_r2()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: attachment_id,
    Body: content,
    ContentType: mimetype,
  }))
}
