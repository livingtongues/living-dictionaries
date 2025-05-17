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

const date_for_updating_all_caches = '1970-01-01T00:00:00Z'
const hours_since_last_update = 1.5
const milliseconds_since_last_update = hours_since_last_update * 60 * 60 * 1000
const date_since_last_update = new Date(Date.now() - milliseconds_since_last_update).toISOString()

await write_caches()
async function write_caches() {
  let current_dict = ''
  try {
    const { data: dictionary_ids } = await admin_supabase.from('dictionaries')
      .select('id')
      .order('id')
      // .range(1000, 1999)
      // 1st do public
      // .eq('public', true)
      // 2nd do private but not conlang (won't cache those)
      // .neq('public', true)
      // .is('con_language_description', null)
      .order('updated_at', { ascending: true })
      .gt('updated_at', date_since_last_update)

    console.log(`Writing caches for ${dictionary_ids.length} dictionaries...`)

    for (const { id: dictionary_id } of dictionary_ids) {
      console.log(`Processing ${dictionary_id}`)
      const format = 'json'
      const folder = './caches'
      const filename = `${dictionary_id}.${format}`
      const filepath = path.join(__dirname, folder, filename)

      // if (await file_exists(filepath)) {
      //   continue
      // }

      current_dict = dictionary_id

      async function get_table<Name extends TableNames, T extends Tables<Name>>({ table, include, id_field_1, id_field_2 }: {
        table: Name
        include?: (keyof T)[]
        id_field_1?: keyof T
        id_field_2?: keyof T
      }) {
        const order_field = include ? 'updated_at' : 'created_at'
        let data: Record<string, T> = {}
        let select_fields: (keyof T)[]
        if (include) {
          select_fields = ['id', ...include, order_field] as (keyof T)[]
        } else {
          select_fields = [order_field, id_field_1, id_field_2] as (keyof T)[]
        }

        let range_start = 0
        const limit = 1000
        const range_field = id_field_1 || 'id'

        while (true) {
          const { data: batch, error: batch_error } = await admin_supabase.from(table)
            .select(select_fields.join(', '))
            .eq('dictionary_id', dictionary_id)
            .is('deleted', null)
            .order(range_field as string, { ascending: true })
            .range(range_start, range_start + limit - 1)
          range_start += limit

          if (batch_error) {
            console.error({ batch_error })
            throw new Error(`Error fetching ${table} data: ${batch_error.message}`)
          }

          if (batch?.length) {
            if (id_field_1 && id_field_2) {
              const batch_object = batch.reduce((acc, item) => {
                const combined_id = `${(item as T)[id_field_1]}_${(item as T)[id_field_2]}`
                acc[combined_id] = item as T
                return acc
              }, {} as Record<string, T>)
              data = { ...data, ...batch_object }
            } else {
              const batch_without_nulls = batch.reduce((acc, item) => {
                const item_without_nulls = Object.fromEntries(
                  Object.entries(item).filter(([_, value]) => value !== null),
                ) as T
                // @ts-expect-error
                acc[item_without_nulls.id] = item_without_nulls
                return acc
              }, {} as Record<string, T>)

              data = { ...data, ...batch_without_nulls }
            }

            if (batch.length < 1000) {
              break
            }
          } else {
            break
          }
        }

        if (table !== 'entries' && order_field === 'updated_at') {
          data = Object.fromEntries(
            Object.entries(data).map(([key, item]) => {
              // @ts-expect-error
              const { updated_at, ...rest } = item
              return [key, rest] as [string, T]
            }),
          )
        }
        return data
      }

      const entries_promise = get_table({ table: 'entries', include: ['coordinates', 'elicitation_id', 'interlinearization', 'lexeme', 'morphology', 'notes', 'phonetic', 'scientific_names', 'sources'] })
      const senses_promise = get_table({ table: 'senses', include: ['created_at', 'entry_id', 'definition', 'glosses', 'noun_class', 'parts_of_speech', 'plural_form', 'semantic_domains', 'variant', 'write_in_semantic_domains'] })
      const audios_promise = get_table({ table: 'audio', include: ['created_at', 'entry_id', 'source', 'storage_path'] })
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
        entries,
        senses,
        audios,
        speakers,
        tags,
        dialects,
        photos,
        videos,
        sentences,
        audio_speakers,
        entry_tags,
        entry_dialects,
        sense_photos,
        video_speakers,
        sense_videos,
        senses_in_sentences,
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

      const entry_id_to_tags: Record<string, Tables<'tags'>[]> = {}
      const entry_id_to_dialects: Record<string, Tables<'dialects'>[]> = {}
      const entry_id_to_senses: Record<string, Tables<'senses'>[]> = {}
      const sense_id_to_sentences: Record<string, Tables<'sentences'>[]> = {}
      const sense_id_to_photos: Record<string, Tables<'photos'>[]> = {}
      const video_id_to_speakers: Record<string, Tables<'speakers'>[]> = {}
      const sense_id_to_videos: Record<string, Tables<'videos'>[]> = {}
      const audio_id_to_speakers: Record<string, Tables<'speakers'>[]> = {}
      const entry_id_to_audios: Record<string, Tables<'audio'>[]> = {}

      for (const entry_tag of Object.values(entry_tags)) {
        if (!entry_id_to_tags[entry_tag.entry_id]) entry_id_to_tags[entry_tag.entry_id] = []
        const tag = tags[entry_tag.tag_id]
        entry_id_to_tags[entry_tag.entry_id].push(tag)
      }

      for (const entry_dialect of Object.values(entry_dialects)) {
        if (!entry_id_to_dialects[entry_dialect.entry_id]) entry_id_to_dialects[entry_dialect.entry_id] = []
        const dialect = dialects[entry_dialect.dialect_id]
        entry_id_to_dialects[entry_dialect.entry_id].push(dialect)
      }

      for (const sense of Object.values(senses)) {
        if (!entry_id_to_senses[sense.entry_id]) entry_id_to_senses[sense.entry_id] = []
        entry_id_to_senses[sense.entry_id].push(sense)
        if (entry_id_to_senses[sense.entry_id].length > 1) {
          entry_id_to_senses[sense.entry_id].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        }
      }

      for (const { sense_id, sentence_id } of Object.values(senses_in_sentences)) {
        if (!sense_id_to_sentences[sense_id]) sense_id_to_sentences[sense_id] = []
        sense_id_to_sentences[sense_id].push(sentences[sentence_id])
        // if (!sentence_id_to_sense_ids[sentence_id]) sentence_id_to_sense_ids[sentence_id] = []
        // sentence_id_to_sense_ids[sentence_id].push(sense_id)
      }

      for (const { sense_id, photo_id } of Object.values(sense_photos)) {
        if (!sense_id_to_photos[sense_id]) sense_id_to_photos[sense_id] = []
        sense_id_to_photos[sense_id].push(photos[photo_id])
        // if (!photo_id_to_sense_ids[photo_id]) photo_id_to_sense_ids[photo_id] = []
        // photo_id_to_sense_ids[photo_id].push(sense_id)
      }

      for (const video_speaker of Object.values(video_speakers)) {
        if (!video_id_to_speakers[video_speaker.video_id]) video_id_to_speakers[video_speaker.video_id] = []
        const speaker = speakers[video_speaker.speaker_id]
        video_id_to_speakers[video_speaker.video_id].push(speaker)
      }
      for (const { sense_id, video_id } of Object.values(sense_videos)) {
        if (!sense_id_to_videos[sense_id]) sense_id_to_videos[sense_id] = []
        const video = videos[video_id]

        sense_id_to_videos[sense_id].push({
          ...video,
          ...(video_id_to_speakers[video_id] ? { speakers: video_id_to_speakers[video_id] } : {}),
        })

        // if (!video_id_to_sense_ids[video_id]) video_id_to_sense_ids[video_id] = []
        // video_id_to_sense_ids[video_id].push(sense_id)
      }

      for (const audio_speaker of Object.values(audio_speakers)) {
        if (!audio_id_to_speakers[audio_speaker.audio_id]) audio_id_to_speakers[audio_speaker.audio_id] = []
        const speaker = speakers[audio_speaker.speaker_id]
        audio_id_to_speakers[audio_speaker.audio_id].push(speaker)
      }
      for (const audio of Object.values(audios)) {
        if (!entry_id_to_audios[audio.entry_id]) entry_id_to_audios[audio.entry_id] = []
        entry_id_to_audios[audio.entry_id].push({
          ...audio,
          ...(audio_id_to_speakers[audio.id] ? { speakers: audio_id_to_speakers[audio.id] } : {}),
        })
        if (entry_id_to_audios[audio.entry_id].length > 1) {
          entry_id_to_audios[audio.entry_id].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        }
      }

      const entries_data: EntryData[] = Object.values(entries).map((entry) => {
        return process_entry(entry)
      })

      function process_entry(entry: Tables<'entries'>) {
        const { id, deleted, dictionary_id, created_at, created_by, updated_by, updated_at, ...main } = entry

        const senses_for_entry = entry_id_to_senses[id] || []
        const senses_with_all = senses_for_entry.map((sense) => {
          const { entry_id, ...sense_to_include } = sense

          return {
            ...sense_to_include,
            ...(sense_id_to_sentences[sense.id] ? { sentences: sense_id_to_sentences[sense.id] } : {}),
            ...(sense_id_to_photos[sense.id] ? { photos: sense_id_to_photos[sense.id] } : {}),
            ...(sense_id_to_videos[sense.id] ? { videos: sense_id_to_videos[sense.id] } : {}),
          }
        })
        return {
          id,
          main,
          updated_at,
          senses: senses_with_all,
          ...(entry_id_to_audios[id] ? { audios: entry_id_to_audios[id] } : {}),
          ...(entry_id_to_tags[id] ? { tags: entry_id_to_tags[id] } : {}),
          ...(entry_id_to_dialects[id] ? { dialects: entry_id_to_dialects[id] } : {}),
          ...(deleted ? { deleted } : {}),
        }
      }

      if (entries_data.length === 0) {
        console.log(`${dictionary_id}: none`)
        continue
      }

      const cache_json_string = JSON.stringify(entries_data)
      if (process.env.CI !== 'true') {
        await writeFile(filepath, cache_json_string)
      }
      await upload_to_cloudflare(filename, cache_json_string)
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
  const MINUTES_TO_WAIT_BEFORE_REVALIDATION = 10

  try {
    const command = new PutObjectCommand({
      Bucket: 'cache',
      Key: `entries_data/${filename}`,
      Body: cache_json_string,
      ContentType: 'application/json',
      CacheControl: `max-age=${MINUTES_TO_WAIT_BEFORE_REVALIDATION * 60}`,
    // CacheControl: 'no-cache', // revalidate on every request
    })
    await cache_client.send(command)
    console.log(`Uploaded ${filename} to Cloudflare R2`)
  } catch (err) {
    console.error(`Error uploading ${filename} to Cloudflare R2: ${err}`)
  }
}

type TableNames = 'entries' | 'senses' | 'audio' | 'speakers' | 'tags' | 'dialects' | 'photos' | 'videos' | 'sentences' | 'audio_speakers' | 'video_speakers' | 'entry_tags' | 'entry_dialects' | 'sense_photos' | 'sense_videos' | 'senses_in_sentences'
