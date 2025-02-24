import { S3Client } from '@aws-sdk/client-s3'
import { config } from 'dotenv'

config({ path: '../site/.env.production.local' })

const GCLOUD_MEDIA_BUCKET_S3 = new S3Client({
  region: 'us',
  endpoint: `https://storage.googleapis.com`,
  credentials: {
    accessKeyId: process.env.GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID!, // Get these by going to Settings in your bucket > Interoperability and creating a Service Account HMAC (may also require creating a new service account)
    secretAccessKey: process.env.GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY!,
  },
})

export { GCLOUD_MEDIA_BUCKET_S3 }
