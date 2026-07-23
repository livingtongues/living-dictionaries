import { S3Client } from '@aws-sdk/client-s3'
import { env } from '$env/dynamic/private'
import { R2_MEDIA_BUCKET } from '$lib/constants'

/**
 * R2 client pointed at the PUBLIC media bucket (`livingdictionaries-media`,
 * served via media.livingdictionaries.app) — audio/video bytes on the new
 * `{dict_id}/{kind}/{media_row_id}.{ext}` key convention (photos migrate in
 * Phase 2). Same account creds as the snapshots/attachments clients; only the
 * bucket differs. Not configured (e.g. local dev) → callers fall back to the
 * dev-media store / 503, mirroring the GCS pattern.
 */

let media_client_singleton: S3Client | null = null

export function r2_media_is_configured(): boolean {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY)
}

export function get_r2_media(): { client: S3Client, bucket: string } {
  if (media_client_singleton)
    return { client: media_client_singleton, bucket: R2_MEDIA_BUCKET }
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY)
    throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY must be configured for media uploads')
  media_client_singleton = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
  return { client: media_client_singleton, bucket: R2_MEDIA_BUCKET }
}

/** Test-only: clear the singleton so tests that stub env vars get a fresh client. */
export function reset_r2_media_client(): void {
  media_client_singleton = null
}
