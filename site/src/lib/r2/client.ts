import { S3Client } from '@aws-sdk/client-s3'
import { env } from '$env/dynamic/private'

/**
 * Singleton `S3Client` pointed at Cloudflare R2's S3-compatible endpoint.
 *
 * R2 doesn't use AWS regions — pass `region: 'auto'` and the endpoint URL
 * derived from the account ID. The bucket name is chosen per-env via
 * `R2_SNAPSHOTS_BUCKET`.
 *
 * For LD specifically, this is the public snapshots bucket fronted by
 * `snapshots.livingdictionaries.app` (CNAME → R2). Public-read access is
 * configured on the bucket itself; the S3Client is server-side only and
 * only writes (PutObjectCommand).
 */

let r2_client_singleton: S3Client | null = null
let r2_bucket_singleton: string | null = null

export function get_r2(): { client: S3Client, bucket: string } {
  if (r2_client_singleton && r2_bucket_singleton)
    return { client: r2_client_singleton, bucket: r2_bucket_singleton }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_SNAPSHOTS_BUCKET } = env

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_SNAPSHOTS_BUCKET)
    throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_SNAPSHOTS_BUCKET must be configured')

  r2_client_singleton = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
  r2_bucket_singleton = R2_SNAPSHOTS_BUCKET
  return { client: r2_client_singleton, bucket: r2_bucket_singleton }
}

export function reset_r2_client(): void {
  r2_client_singleton = null
  r2_bucket_singleton = null
}
