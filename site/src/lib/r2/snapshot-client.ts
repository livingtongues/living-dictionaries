import { S3Client } from '@aws-sdk/client-s3'
import { env } from '$env/dynamic/private'

/**
 * R2 client pointed at the **snapshots** bucket (`R2_SNAPSHOTS_BUCKET`) —
 * separate from the attachments bucket (`get_r2` in `./client`) because:
 *
 *   1. The snapshots bucket is fronted by a custom CNAME
 *      (`snapshots.livingdictionaries.app` → R2) with public-read + CORS so
 *      viewer clients can fetch dict snapshots directly. The attachments
 *      bucket is admin-private (streamed only through authed endpoints).
 *   2. Cache-Control / overwrite semantics differ; mixing the buckets risks
 *      accidentally exposing an attachment publicly.
 *
 * Reuses the same account ID + access keys (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
 * R2_SECRET_ACCESS_KEY) — only the bucket changes. Server-side only; writes
 * snapshots (PutObjectCommand) and drops them on dictionary teardown.
 */

let r2_client_singleton: S3Client | null = null
let r2_bucket_singleton: string | null = null

export function get_r2_snapshot_client(): { client: S3Client, bucket: string } {
  if (r2_client_singleton && r2_bucket_singleton)
    return { client: r2_client_singleton, bucket: r2_bucket_singleton }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_SNAPSHOTS_BUCKET } = env

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_SNAPSHOTS_BUCKET)
    throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_SNAPSHOTS_BUCKET must be configured for snapshot uploads')

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

/** Test-only: clear the singleton so tests that stub env vars get a fresh client. */
export function reset_r2_snapshot_client(): void {
  r2_client_singleton = null
  r2_bucket_singleton = null
}
