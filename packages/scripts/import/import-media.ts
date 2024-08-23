import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as fs from 'node:fs'
import type { GoalDatabasePhoto } from '@living-dictionaries/types'
import { environment, storage } from '../config-firebase.js'
import { getImageServingUrl } from './getImageServingUrl.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const fileBucket = `talking-dictionaries-${environment === 'prod' ? 'alpha' : 'dev'}.appspot.com`

export async function uploadAudioFile(
  audioFileName: string,
  entryId: string,
  dictionaryId: string,
  live = false,
): Promise<string> {
  const audioDir = join(__dirname, `data/${dictionaryId}/audio`)
  const audioFilePath = join(audioDir, audioFileName)

  if (!fs.existsSync(audioFilePath)) {
    console.log(`>> Missing audio file: ${audioFileName}`)
    return null
  }

  try {
    const [fileTypeSuffix] = audioFileName.match(/\.[0-9a-z]+$/i)
    const uploadedAudioPath = `${dictionaryId}/audio/${entryId}_${new Date().getTime()}${fileTypeSuffix}`

    if (live) {
      await storage.bucket(fileBucket).upload(audioFilePath, {
        destination: uploadedAudioPath,
        metadata: {
          originalFileName: audioFileName,
        },
      })
    }
    return uploadedAudioPath
  } catch (err) {
    throw new Error(`Not adding audio ${audioFileName} as the server had trouble uploading it. Double-check the file to see if there is a problem with it or perhaps there is code/server/network-connection problem. Error: ${err}`)
  }
}

export async function uploadImageFile(
  imageFileName: string,
  entryId: string,
  dictionaryId: string,
  live = false,
): Promise<GoalDatabasePhoto> {
  const imageDir = join(__dirname, `data/${dictionaryId}/images`)
  const imageFilePath = join(imageDir, imageFileName)

  if (!fs.existsSync(imageFilePath)) {
    console.log(`>> Missing image file: ${imageFileName}`)
    return null
  }

  try {
    const [fileTypeSuffix] = imageFileName.match(/\.[0-9a-z]+$/i)
    const storagePath = `${dictionaryId}/images/${entryId}_${new Date().getTime()}${fileTypeSuffix}`
    if (!live)
      return { path: storagePath, gcs: 'no-path-bc-dry-run' }

    await storage.bucket(fileBucket).upload(imageFilePath, {
      destination: storagePath,
      metadata: {
        originalFileName: imageFileName,
      },
    })

    let gcsPath
    try {
      gcsPath = await getImageServingUrl(storagePath, environment)
    } catch (err) {
      throw new Error(`!!! Error getting image serving URL: ${err}`)
    }

    return {
      path: storagePath,
      gcs: gcsPath,
      ts: new Date().getTime(),
      // cr: // not yet included in import template
    }
  } catch (err) {
    throw new Error(`!!! Not adding image ${imageFileName} as the server had trouble digesting it. Double-check the file to see if it is just a corrupted jpg (as some are) or if the file is good and perhaps there is code/server/network-connection problem. Error: ${err}`)
  }
}
