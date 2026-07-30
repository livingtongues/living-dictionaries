import { S3Client } from '@aws-sdk/client-s3'
import { env } from '$env/dynamic/private'
import { R2_OG_CACHE_BUCKET } from '$lib/constants'

/**
 * R2 client pointed at the share-card store (`livingdictionaries-og-cache`).
 *
 * Its own bucket, not a prefix in the media bucket: `bin/backup-media` mirrors
 * the media bucket wholesale into a 1-year-locked prefix, and a share card is
 * regenerable by definition — it must never be backed up. Nothing else here is
 * special; same account credentials as media/snapshots/attachments.
 *
 * NOT CONFIGURED (local dev, or before the bucket exists) is a normal state, not
 * an error: `og_cache_is_configured()` is false and the store is disk-only,
 * exactly as it behaved before R2 existed.
 */

let og_cache_client_singleton: S3Client | null = null

export function og_cache_is_configured(): boolean {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY)
}

export function get_r2_og_cache(): { client: S3Client, bucket: string } {
  if (og_cache_client_singleton)
    return { client: og_cache_client_singleton, bucket: R2_OG_CACHE_BUCKET }
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY)
    throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY must be configured for the og card store')
  og_cache_client_singleton = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    // A card is never worth a retry storm: the caller degrades to a render (or a
    // stored card) in milliseconds, and every extra attempt holds a socket open
    // behind a timeout that is already deliberately short.
    maxAttempts: 1,
  })
  return { client: og_cache_client_singleton, bucket: R2_OG_CACHE_BUCKET }
}

/** Test-only: clear the singleton so tests that stub env vars get a fresh client. */
export function reset_r2_og_cache_client(): void {
  og_cache_client_singleton = null
}
