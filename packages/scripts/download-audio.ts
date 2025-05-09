import * as fs from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { friendlyName } from '@living-dictionaries/site/src/routes/[dictionaryId]/export/friendlyName'
import { GCLOUD_MEDIA_BUCKET_S3 } from './gcs'
import { admin_supabase } from './config-supabase'

const directory_path = 'downloaded'

async function download_dictionary_audio(dictionary_id: string) {
  let entries = []
  let offset = 0
  const limit = 1000

  do {
    const { data, error } = await admin_supabase.from('materialized_entries_view')
      .select('id, main, audios, senses')
      .eq('dictionary_id', dictionary_id)
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching entries:', error)
      throw new Error(error.message)
    }

    entries = entries.concat(data)
    offset += limit
  } while (entries.length % limit === 0 && entries.length !== 0)

  const photo_ids = entries.flatMap(({ senses }) => (senses || []).map(({ photo_ids }) => photo_ids).flat()).filter(Boolean) // just for logging
  const audio_ids = entries.flatMap(({ audios }) => (audios || []).map(({ id }) => id)) // just for logging
  console.log({ entries_length: entries.length, photo_ids_length: photo_ids.length, audio_ids_length: audio_ids.length })

  for (const entry of entries.splice(0, 200)) {
    for (const audio of entry.audios || []) {
      const { Body } = await GCLOUD_MEDIA_BUCKET_S3.send(new GetObjectCommand({
        Bucket: 'talking-dictionaries-alpha.appspot.com',
        Key: audio.storage_path,
      }))

      const friendly_audio_name = friendlyName(entry, audio.storage_path)
      const filePath = `${directory_path}/${friendly_audio_name}`
      // @ts-expect-error Body isn't typed as a ReadableStream but it still works
      await pipeline(Body, fs.createWriteStream(filePath))
    }
  }
}

download_dictionary_audio('babanki')
