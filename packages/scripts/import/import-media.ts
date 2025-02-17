import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as fs from 'node:fs'
import { environment, storage } from '../config-firebase.js'
import { getImageServingUrl } from './getImageServingUrl.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const fileBucket = `talking-dictionaries-${environment === 'prod' ? 'alpha' : 'dev'}.appspot.com`

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
    const [fileTypeSuffix] = filepath.match(/\.[0-9a-z]+$/i)
    const storage_path = `${dictionary_id}/audio/${entry_id}_${new Date().getTime()}${fileTypeSuffix}`

    if (live) {
      await storage.bucket(fileBucket).upload(audioFilePath, {
        destination: storage_path,
        metadata: {
          originalFileName: filepath,
        },
      })
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

  const [fileTypeSuffix] = filepath.match(/\.[0-9a-z]+$/i)
  const storage_path = `${dictionary_id}/images/${entry_id}_${new Date().getTime()}${fileTypeSuffix}`

  if (!live)
    return { storage_path, serving_url: 'no-serving_url-bc-dry-run' }

  try {
    await storage.bucket(fileBucket).upload(imageFilePath, {
      destination: storage_path,
      metadata: {
        originalFileName: filepath,
      },
    })
  } catch (err) {
    return {
      error: `!!! Trouble uploading ${filepath}. Double-check the file to see if it is just a corrupted jpg (as some are) or if the file is good and perhaps there is code/server/network-connection problem. Error: ${err}`,
    }
  }

  try {
    const serving_url = await getImageServingUrl(storage_path, environment)
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
