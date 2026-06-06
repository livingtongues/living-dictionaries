import { S3Client } from '@aws-sdk/client-s3'
import { env } from '$env/dynamic/private'

/**
 * R2 client pointed at the **attachments** bucket (`R2_ATTACHMENTS_BUCKET`) —
 * the private bucket the inbound-email Cloudflare Worker `.put()`s message
 * attachments into (keyed by the attachment UUID), and that
 * `/api/messages/*` writes outbound attachments to. Separate from the
 * snapshots bucket (`get_r2_snapshot_client` in `./snapshot-client`, public
 * CNAME) because attachments must stay private — they're streamed back only
 * through admin-authed endpoints.
 *
 * Reuses the same account ID + access keys as the snapshot client
 * (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY) — only the bucket
 * differs.
 */

let r2_client_singleton: S3Client | null = null
let r2_bucket_singleton: string | null = null

export function get_r2(): { client: S3Client, bucket: string } {
  if (r2_client_singleton && r2_bucket_singleton)
    return { client: r2_client_singleton, bucket: r2_bucket_singleton }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ATTACHMENTS_BUCKET } = env

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ATTACHMENTS_BUCKET)
    throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ATTACHMENTS_BUCKET must be configured for attachments')

  r2_client_singleton = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
  r2_bucket_singleton = R2_ATTACHMENTS_BUCKET
  return { client: r2_client_singleton, bucket: r2_bucket_singleton }
}

/** Test-only: clear the singleton so tests that stub env vars get a fresh client. */
export function reset_r2_client(): void {
  r2_client_singleton = null
  r2_bucket_singleton = null
}
