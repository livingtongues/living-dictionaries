import process from 'node:process'
import { S3Client } from '@aws-sdk/client-s3'
import { env } from '$env/dynamic/private'
import { R2_MEDIA_BUCKET } from '$lib/constants'

/**
 * R2 client pointed at the public media bucket (`livingdictionaries-media`,
 * served via media.livingdictionaries.app). Same account credentials as the
 * snapshots/attachments clients; only the bucket differs. Not configured
 * (e.g. local dev) → callers use the dev-media store or return 503.
 */

let media_client_singleton: S3Client | null = null

/**
 * `$env/dynamic/private` is populated by `Server.init()` in `build/index.js` —
 * which a FORKED CHUNK never runs, so it reads as EMPTY there (see the header of
 * `analytics-snapshot.ts`). The audio-derivative backfill child fetches and
 * uploads R2 objects, so it needs these values; `process.env` carries the
 * identical ones (the container's env_file feeds both). Server-only module, so
 * reading `process.env` here leaks nothing to the client.
 */
function r2_env(name: 'R2_ACCOUNT_ID' | 'R2_ACCESS_KEY_ID' | 'R2_SECRET_ACCESS_KEY'): string | undefined {
  return env[name] || process.env[name]
}

export function r2_media_is_configured(): boolean {
  return Boolean(r2_env('R2_ACCOUNT_ID') && r2_env('R2_ACCESS_KEY_ID') && r2_env('R2_SECRET_ACCESS_KEY'))
}

export function get_r2_media(): { client: S3Client, bucket: string } {
  if (media_client_singleton)
    return { client: media_client_singleton, bucket: R2_MEDIA_BUCKET }
  const R2_ACCOUNT_ID = r2_env('R2_ACCOUNT_ID')
  const R2_ACCESS_KEY_ID = r2_env('R2_ACCESS_KEY_ID')
  const R2_SECRET_ACCESS_KEY = r2_env('R2_SECRET_ACCESS_KEY')
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
