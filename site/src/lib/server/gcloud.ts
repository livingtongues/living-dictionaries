import { S3Client } from '@aws-sdk/client-s3'
import { env } from '$env/dynamic/private'

/* Requires adjusting CORS settings on bucket.
  1) Go to the Cloud Shell from the Google Cloud Console where your bucket exists
  2) Create a file called my_cors.json with the following content:
  [
    {
      "origin": ["http://livingdictionaries.app"],
      "responseHeader": ["Content-Type"],
      "method": ["GET", "PUT", "POST"],
      "maxAgeSeconds": 3600
    }
  ]
  3) Run `gcloud storage buckets update gs://bucket-name --cors-file=my_cors.json` to set
  4) Run `gcloud storage buckets describe gs://bucket-name --format="default(cors_config)"` to verify
*/

const DEV_BUCKET = 'talking-dictionaries-dev.appspot.com'
const PROD_BUCKET = 'talking-dictionaries-alpha.appspot.com'

// Media (audio/photos/videos) lives in the LEGACY Google Cloud Storage bucket (NOT R2).
// GCS interoperability uses S3-compatible HMAC keys (Service Account HMAC, created under the
// bucket's Interoperability settings), so the same `@aws-sdk/client-s3` works against the
// `storage.googleapis.com` endpoint. Credentials are read at runtime via `$env/dynamic/private`
// so the VPS env_file can set them without a rebuild; when unset, `/api/upload` returns 503
// (media uploads dormant) rather than throwing at import time.

let gcs_client_singleton: S3Client | null = null

export function gcs_is_configured(): boolean {
  return Boolean(env.GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID && env.GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY)
}

export function get_gcs(): { client: S3Client, bucket: string } {
  const { GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID, GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY } = env
  if (!GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID || !GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY)
    throw new Error('GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID and GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY must be configured')

  gcs_client_singleton ||= new S3Client({
    region: 'us',
    endpoint: 'https://storage.googleapis.com',
    credentials: {
      accessKeyId: GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID,
      secretAccessKey: GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY,
    },
  })

  return { client: gcs_client_singleton, bucket: import.meta.env.DEV ? DEV_BUCKET : PROD_BUCKET }
}

export function reset_gcs_client(): void {
  gcs_client_singleton = null
}
