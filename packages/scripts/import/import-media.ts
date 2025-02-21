import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fs from 'node:fs'

import { PutObjectCommand } from '@aws-sdk/client-s3'
import { GCLOUD_MEDIA_BUCKET_S3, storage_bucket } from '../config-supabase'
import { getImageServingUrl } from './getImageServingUrl'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function upload_audio_to_gcs({
  filepath,
  entry_id,
  dictionary_id,
  live = false,
}: {
  filepath: string
  entry_id: string
  dictionary_id: string
  live?: boolean
}) {
  const audioDir = join(__dirname, `data/${dictionary_id}/audio`)
  const audioFilePath = join(audioDir, filepath)

  if (!fs.existsSync(audioFilePath)) {
    return {
      error: `!!! Missing audio file: ${filepath}`,
    }
  }

  try {
    const extension = filepath.split('.').pop()
    const storage_path = `${dictionary_id}/audio/${entry_id}_${new Date().getTime()}.${extension}`

    if (live) {
      const fileStream = fs.createReadStream(audioFilePath)

      const mimeTypes: Record<string, string> = {
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        m4a: 'audio/mp4',
        aac: 'audio/aac',
        flac: 'audio/flac',
        wma: 'audio/x-ms-wma',
      }

      const file_type = mimeTypes[extension] || 'application/octet-stream'

      await GCLOUD_MEDIA_BUCKET_S3.send(new PutObjectCommand({
        Bucket: storage_bucket,
        Key: storage_path,
        Body: fileStream,
        ContentType: file_type,
      }))
    }
    return {
      storage_path,
    }
  } catch (err) {
    return {
      error: `!!! Trouble uploading ${filepath}. Error: ${err}`,
    }
  }
}

export async function upload_photo_to_gcs({
  filepath,
  entry_id,
  dictionary_id,
  live = false,
}: {
  filepath: string
  entry_id: string
  dictionary_id: string
  live?: boolean
}) {
  const imageDir = join(__dirname, `data/${dictionary_id}/images`)
  const imageFilePath = join(imageDir, filepath)

  if (!fs.existsSync(imageFilePath)) {
    return {
      error: `!!! Missing image file: ${filepath}`,
    }
  }

  const extension = filepath.split('.').pop()
  const storage_path = `${dictionary_id}/images/${entry_id}_${new Date().getTime()}.${extension}`

  if (!live)
    return { storage_path, serving_url: 'no-serving_url-bc-dry-run' }

  try {
    const fileStream = fs.createReadStream(imageFilePath)

    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    }

    const file_type = mimeTypes[extension] || 'application/octet-stream'

    await GCLOUD_MEDIA_BUCKET_S3.send(new PutObjectCommand({
      Bucket: storage_bucket,
      Key: storage_path,
      Body: fileStream,
      ContentType: file_type,
    }))
  } catch (err) {
    return {
      error: `!!! Trouble uploading ${filepath}. Double-check the file to see if it is just a corrupted jpg (as some are) or if the file is good and perhaps there is code/server/network-connection problem. Error: ${err}`,
    }
  }

  try {
    const bucket_and_storage_path = `${storage_bucket}/${storage_path}`
    const serving_url = await getImageServingUrl(bucket_and_storage_path)
    return {
      storage_path,
      serving_url,
    }
  } catch (err) {
    return {
      error: `!!! Error getting image serving URL for ${storage_path}: ${err}`,
    }
  }
}
