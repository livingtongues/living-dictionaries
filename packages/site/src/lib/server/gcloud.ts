import { S3Client } from '@aws-sdk/client-s3'
import { GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID, GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY } from '$env/static/private'

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
const GCLOUD_MEDIA_BUCKET_S3 = new S3Client({
  region: 'us',
  endpoint: `https://storage.googleapis.com`,
  credentials: {
    // Get these by going to Settings in your bucket > Interoperability and creating a Service Account HMAC (may also require creating a new service account)
    accessKeyId: GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID,
    secretAccessKey: GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY,
  },
})

export { GCLOUD_MEDIA_BUCKET_S3 }
