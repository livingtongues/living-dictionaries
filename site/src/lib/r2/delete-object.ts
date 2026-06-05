import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { get_r2 } from './client'

/**
 * Delete a single object from the R2 snapshots bucket. Best-effort: a missing
 * key is not an error on R2 (DeleteObject is idempotent). Used by the
 * dictionary-teardown endpoint to drop a deleted dictionary's snapshot
 * (`dictionaries/{id}.db.gz`).
 */
export async function delete_object({ key }: { key: string }): Promise<void> {
  const { client, bucket } = get_r2()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
