// pnpm -F scripts create-entry-caches
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { access, constants, writeFile } from 'node:fs/promises'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { EntryData, Tables } from '@living-dictionaries/types'
import { admin_supabase } from '../config-supabase'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const r2_account_id = process.env.CLOUDFLARE_R2_ACCOUNT_ID
const s3_api = `https://${r2_account_id}.r2.cloudflarestorage.com`

const cache_client = new S3Client({
  region: 'auto',
  endpoint: s3_api,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_CACHE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_CACHE_SECRET_ACCESS_KEY,
  },
})

// const date_for_updating_all_caches = '1970-01-01T00:00:00Z'
// const caches_last_updated = date_for_updating_all_caches
// const caches_last_updated = '2024-11-15T00:00:00Z' // do this next time

await write_caches()
async function write_caches() {
  let current_dict = ''
  try {
    const { data: dictionary_ids } = await admin_supabase.from('dictionaries')
      .select('id')
      .order('id')
      // public
      // .eq('public', true)
      // private but not conlang (won't cache those)
      .neq('public', true)
      .is('con_language_description', null)

    for (const { id: dictionary_id } of dictionary_ids) {
      const format = 'json'
      const folder = './caches'
      const filename = `${dictionary_id}.${format}`
      const filepath = path.join(__dirname, folder, filename)

      if (await file_exists(filepath)) {
        continue
      }

      current_dict = dictionary_id

      async function get_table<Name extends TableNames, T extends Tables<Name>>({ table, include, id_field_1, id_field_2 }: {
        table: Name
        include?: (keyof T)[]
        id_field_1?: keyof T
        id_field_2?: keyof T
      }) {
        const order_field = include ? 'updated_at' : 'created_at'
        const data: T[] = []
        let timestamp_from_which_to_fetch_data = '1970-01-01T00:00:00Z'
        while (true) {
          if (data.length) {
            const last_item = data[data.length - 1]
            // @ts-expect-error
            timestamp_from_which_to_fetch_data = last_item[order_field] as string
          }

          let select_fields: (keyof T)[]
          if (include) {
            select_fields = ['id', ...include, order_field] as (keyof T)[]
          } else {
            select_fields = [order_field, id_field_1, id_field_2] as (keyof T)[]
          }

          const { data: batch, error: batch_error } = await admin_supabase
            .from(table)
            .select(select_fields.join(', '))
            .eq('dictionary_id', dictionary_id)
            .is('deleted', null)
            .limit(1000)
            .order(order_field, { ascending: true })
            .gt(order_field, timestamp_from_which_to_fetch_data)

          if (batch_error) {
            console.error({ batch_error })
            throw new Error(`Error fetching ${table} data: ${batch_error.message}`)
          }

          if (batch?.length) {
            const batch_without_nulls = batch.map((item) => {
              const new_item = Object.fromEntries(
                Object.entries(item).filter(([_, value]) => value !== null),
              ) as T
              return new_item
            })
            data.push(...batch_without_nulls)
            if (batch.length < 1000) {
              break
            }
          } else {
            break
          }
        }

        if (table !== 'entries' && order_field === 'updated_at') {
          return data.map((item) => {
            // @ts-expect-error
            const { updated_at, ...rest } = item
            return rest as T
          })
        }
        return data
      }

      const entries_promise = get_table({ table: 'entries', include: ['coordinates', 'elicitation_id', 'interlinearization', 'lexeme', 'morphology', 'notes', 'phonetic', 'scientific_names', 'sources'] })
      const senses_promise = get_table({ table: 'senses', include: ['entry_id', 'definition', 'glosses', 'noun_class', 'parts_of_speech', 'plural_form', 'semantic_domains', 'variant', 'write_in_semantic_domains'] })
      const audios_promise = get_table({ table: 'audio', include: ['entry_id', 'source', 'storage_path'] })
      const speakers_promise = get_table({ table: 'speakers', include: ['birthplace', 'decade', 'gender', 'name'] })
      const tags_promise = get_table({ table: 'tags', include: ['name'] })
      const dialects_promise = get_table({ table: 'dialects', include: ['name'] })
      const photos_promise = get_table({ table: 'photos', include: ['photographer', 'storage_path', 'serving_url', 'source'] })
      const videos_promise = get_table({ table: 'videos', include: ['hosted_elsewhere', 'source', 'storage_path', 'videographer'] })
      const sentences_promise = get_table({ table: 'sentences', include: ['text', 'translation'] })

      const audio_speakers_promise = get_table({ table: 'audio_speakers', id_field_1: 'audio_id', id_field_2: 'speaker_id' })
      const entry_tags_promise = get_table({ table: 'entry_tags', id_field_1: 'entry_id', id_field_2: 'tag_id' })
      const entry_dialects_promise = get_table({ table: 'entry_dialects', id_field_1: 'entry_id', id_field_2: 'dialect_id' })
      const sense_photos_promise = get_table({ table: 'sense_photos', id_field_1: 'sense_id', id_field_2: 'photo_id' })
      const video_speakers_promise = get_table({ table: 'video_speakers', id_field_1: 'video_id', id_field_2: 'speaker_id' })
      const sense_videos_promise = get_table({ table: 'sense_videos', id_field_1: 'sense_id', id_field_2: 'video_id' })
      const senses_in_sentences_promise = get_table({ table: 'senses_in_sentences', id_field_1: 'sense_id', id_field_2: 'sentence_id' })

      const [
        $entries,
        $senses,
        $audios,
        $speakers,
        $tags,
        $dialects,
        $photos,
        $videos,
        $sentences,
        $audio_speakers,
        $entry_tags,
        $entry_dialects,
        $sense_photos,
        $video_speakers,
        $sense_videos,
        $senses_in_sentences,
      ] = await Promise.all([
        entries_promise,
        senses_promise,
        audios_promise,
        speakers_promise,
        tags_promise,
        dialects_promise,
        photos_promise,
        videos_promise,
        sentences_promise,
        audio_speakers_promise,
        entry_tags_promise,
        entry_dialects_promise,
        sense_photos_promise,
        video_speakers_promise,
        sense_videos_promise,
        senses_in_sentences_promise,
      ])

      const entries_data: EntryData[] = $entries.map((entry) => {
        const senses_for_entry = $senses.filter(sense => sense.entry_id === entry.id)
          .map((sense) => {
            const sentence_ids = $senses_in_sentences.filter(sense_in_sentence => sense_in_sentence.sense_id === sense.id).map(sense_in_sentence => sense_in_sentence.sentence_id)
            const sentences_for_sense = $sentences.filter(sentence => sentence_ids.includes(sentence.id))
            const photo_ids = $sense_photos.filter(sense_photo => sense_photo.sense_id === sense.id).map(sense_photo => sense_photo.photo_id)
            const photos_for_sense = $photos.filter(photo => photo_ids.includes(photo.id))
            const video_ids = $sense_videos.filter(sense_video => sense_video.sense_id === sense.id).map(sense_video => sense_video.video_id)
            const videos_for_sense = $videos.filter(video => video_ids.includes(video.id))
              .map((video) => {
                const speaker_ids = $video_speakers
                  .filter(vs => vs.video_id === video.id)
                  .map(vs => vs.speaker_id)
                const speakers_for_video = $speakers.filter(speaker => speaker_ids.includes(speaker.id))

                return {
                  ...video,
                  ...(speakers_for_video.length ? { speakers: speakers_for_video } : {}),
                }
              })

            const { entry_id, ...sense_to_include } = sense
            return {
              ...sense_to_include,
              ...(sentences_for_sense.length ? { sentences: sentences_for_sense } : {}),
              ...(photos_for_sense.length ? { photos: photos_for_sense } : {}),
              ...(videos_for_sense.length ? { videos: videos_for_sense } : {}),
            }
          })
        const audios_for_entry = $audios.filter(audio => audio.entry_id === entry.id)
          .map((audio) => {
            const speaker_ids = $audio_speakers
              .filter(as => as.audio_id === audio.id)
              .map(as => as.speaker_id)
            const speakers_for_audio = $speakers.filter(speaker => speaker_ids.includes(speaker.id))

            return {
              ...audio,
              ...(speakers_for_audio.length ? { speakers: speakers_for_audio } : {}),
            }
          })

        const tag_ids = $entry_tags.filter(entry_tag => entry_tag.entry_id === entry.id).map(entry_tag => entry_tag.tag_id)
        const tags_for_entry = $tags.filter(tag => tag_ids.includes(tag.id))
        const dialect_ids = $entry_dialects.filter(entry_dialect => entry_dialect.entry_id === entry.id).map(entry_dialect => entry_dialect.dialect_id)
        const dialects_for_entry = $dialects.filter(dialect => dialect_ids.includes(dialect.id))

        const { id, deleted, dictionary_id, created_at, created_by, updated_by, updated_at, ...main } = entry

        return {
          id,
          main,
          updated_at,
          senses: senses_for_entry,
          ...(audios_for_entry.length ? { audios: audios_for_entry } : {}),
          ...(tags_for_entry.length ? { tags: tags_for_entry } : {}),
          ...(dialects_for_entry.length ? { dialects: dialects_for_entry } : {}),
          ...(deleted ? { deleted } : {}),
        } satisfies EntryData
      })

      if (entries_data.length === 0) {
        console.log(`${dictionary_id}: none`)
        continue
      }

      const cache_json_string = JSON.stringify(entries_data)
      await writeFile(filepath, cache_json_string)
      // await upload_to_cloudflare(filename, cache_json_string)
      console.log({ [dictionary_id]: entries_data.length })
    }
  } catch (err) {
    console.error(`Error with building ${current_dict}: ${err}`)
  }
}

async function file_exists(filepath: string): Promise<boolean> {
  try {
    await access(filepath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function upload_to_cloudflare(filename: string, cache_json_string: string) {
  const params = {
    Bucket: 'cache',
    Key: `entries_data/${filename}`,
    Body: cache_json_string,
    ContentType: 'application/json',
  }

  try {
    const command = new PutObjectCommand(params)
    await cache_client.send(command)
    console.log(`Uploaded ${filename} to Cloudflare R2`)
  } catch (err) {
    console.error(`Error uploading ${filename} to Cloudflare R2: ${err}`)
  }
}

type TableNames = 'entries' | 'senses' | 'audio' | 'speakers' | 'tags' | 'dialects' | 'photos' | 'videos' | 'sentences' | 'audio_speakers' | 'video_speakers' | 'entry_tags' | 'entry_dialects' | 'sense_photos' | 'sense_videos' | 'senses_in_sentences'
