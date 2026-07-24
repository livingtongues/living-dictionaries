import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { dev_media_dir } from './dev-media-dir'
import { get_r2_media, r2_media_is_configured } from './r2-media'

/**
 * Server-side R2 media byte storage for endpoints where bytes reach our server
 * directly (multipart upload, fetched URL, or generated derivative).
 */

export interface StoredMedia {
  /** Object key (also the stored `storage_path`). */
  storage_path: string
  /** Bucket the object landed in ('' in the dev mock). */
  bucket: string
  /** DEV-only: bytes went to the local `/api/dev-media` store, not R2. */
  dev_mock: boolean
}

/** Reason `store_media_bytes` couldn't store (route maps to 503 vs 500). */
export class MediaStorageNotConfiguredError extends Error {}

/**
 * Upload media bytes to the public R2 media bucket and return the object key.
 * On dev with no bucket the bytes land in the local dev-media store; in prod
 * with no credentials it throws
 * {@link MediaStorageNotConfiguredError}.
 */
export async function store_media_bytes({ file_type, bytes, r2_key }: {
  file_type: string
  bytes: Uint8Array
  /** Full `{dict_id}/{kind}/{media_row_id}.{ext}` or derivative key. */
  r2_key: string
}): Promise<StoredMedia> {
  if (!r2_media_is_configured()) {
    if (import.meta.env.DEV) {
      const full = join(dev_media_dir(), r2_key)
      mkdirSync(dirname(full), { recursive: true })
      writeFileSync(full, Buffer.from(bytes))
      return { storage_path: r2_key, bucket: '', dev_mock: true }
    }
    throw new MediaStorageNotConfiguredError('Media uploads are not configured (missing R2 credentials)')
  }

  const { client, bucket } = get_r2_media()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: r2_key,
    Body: bytes,
    ContentType: file_type,
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  return { storage_path: r2_key, bucket, dev_mock: false }
}
