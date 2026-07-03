import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { get_r2 } from './client'

/**
 * Delete a single object from the private attachments bucket. Best-effort +
 * idempotent (a missing key is not an error on R2). Used by chat channel
 * deletion to drop the deleted room's attachment blobs.
 */
export async function delete_attachment({ storage_key }: { storage_key: string }): Promise<void> {
  const { client, bucket } = get_r2()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storage_key }))
}
