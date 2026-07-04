import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { env } from '$env/dynamic/private'
import { DEV_LOCAL_PREFIX } from '$lib/utils/media-url'
import { dev_media_dir } from './dev-media-dir'
import { gcs_is_configured, get_gcs } from './gcloud'

/**
 * Server-side media byte storage for the v1 media write API — the direct-upload
 * counterpart of the browser's presign flow (`api/upload` + `api/gcs_serving_url`).
 * The agent's bytes reach OUR server (multipart or a fetched url), so we PUT them
 * straight to GCS here (or the dev-media store on dev with no bucket), then
 * `fetch_serving_url` mints the lh3 hash photos need.
 */

export interface StoredMedia {
  /** GCS object key (also the stored `storage_path`). */
  storage_path: string
  /** GCS bucket the object landed in ('' in the dev mock). */
  bucket: string
  /** DEV-only: bytes went to the local `/api/dev-media` store, not GCS. */
  dev_mock: boolean
}

/** Reason `store_media_bytes` couldn't store (route maps to 503 vs 500). */
export class MediaStorageNotConfiguredError extends Error {}

/**
 * Upload media bytes and return the stored object key. On dev with no bucket the
 * bytes land in the local dev-media store (served back by `/api/dev-media`); in
 * prod with no GCS creds it throws {@link MediaStorageNotConfiguredError}.
 */
export async function store_media_bytes({ folder, file_name, file_type, bytes }: {
  folder: string
  file_name: string
  file_type: string
  bytes: Uint8Array
}): Promise<StoredMedia> {
  const extension = file_name.split('.').pop() || 'bin'
  const object_key = `${folder}/${crypto.randomUUID()}.${extension}`

  if (!gcs_is_configured()) {
    if (import.meta.env.DEV) {
      const full = join(dev_media_dir(), object_key)
      mkdirSync(dirname(full), { recursive: true })
      writeFileSync(full, Buffer.from(bytes))
      return { storage_path: object_key, bucket: '', dev_mock: true }
    }
    throw new MediaStorageNotConfiguredError('Media uploads are not configured (missing GCS credentials)')
  }

  const { client, bucket } = get_gcs()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: object_key,
    Body: bytes,
    ContentType: file_type,
    ACL: 'public-read',
  }))
  return { storage_path: object_key, bucket, dev_mock: false }
}

const SERVING_URL_PREFIX = 'http://lh3.googleusercontent.com/'

/**
 * Resolve the lh3 `serving_url` hash a photo row needs. On the dev mock it returns
 * the `dev-local:` sentinel; otherwise it calls the App Engine Images service
 * (`PROCESS_IMAGE_URL`) — the same call the `api/gcs_serving_url` route makes.
 */
export async function resolve_photo_serving_url({ bucket, object_key, dev_mock }: {
  bucket: string
  object_key: string
  dev_mock: boolean
}): Promise<string> {
  if (dev_mock)
    return `${DEV_LOCAL_PREFIX}${object_key}`
  return await fetch_serving_url({ storage_path: `${bucket}/${object_key}` })
}

/**
 * Fetch the lh3 serving-url hash for an already-stored object from the App Engine
 * Images service. Throws {@link MediaStorageNotConfiguredError} when the service
 * URL is unset. Shared by the v1 media endpoints and `api/gcs_serving_url`.
 */
export async function fetch_serving_url({ storage_path }: { storage_path: string }): Promise<string> {
  if (!env.PROCESS_IMAGE_URL)
    throw new MediaStorageNotConfiguredError('Image serving-url service is not configured (missing PROCESS_IMAGE_URL)')
  const result = await fetch(`${env.PROCESS_IMAGE_URL}/${storage_path}`)
  const url = (await result.text()).trim()
  if (!url.startsWith(SERVING_URL_PREFIX))
    throw new Error(`Unexpected serving url response: ${url}`)
  return url.replace(SERVING_URL_PREFIX, '')
}
