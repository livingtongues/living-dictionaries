import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TablesUpdate } from '@living-dictionaries/types'
import type { ISpeaker } from '@living-dictionaries/types/speaker.interface'
import { convert_entry } from './convert-entries'
import { assign_dialect, assign_speaker, insert_dialect, insert_entry, insert_photo, insert_sense, insert_sentence, insert_video, upsert_audio, upsert_speaker } from './operations/operations'
import { convert_speaker } from './convert-speakers'
import { log_once } from './log-once'

const import_id = 'fb_sb_migration'
const FOLDER = 'firestore-data'
const __dirname = dirname(fileURLToPath(import.meta.url))

export type AllSpeakerData = Record<string, { supabase_id: string, speaker: TablesUpdate<'speakers'> }>

export async function migrate_speakers() {
  const converted_speakers: AllSpeakerData = {}

  const firebase_speakers = (await import('./firestore-data/firestore-speakers.json')).default as ISpeaker[]

  for (const fb_speaker of firebase_speakers) {
    const { id: firebase_id, speaker } = convert_speaker(JSON.parse(JSON.stringify(fb_speaker)))
    const jacob_test_speaker_id = '2PELJgjxMHXEOcuZfv9MtGyiXdE3'
    if (firebase_id === jacob_test_speaker_id)
      continue

    const supabase_speaker_id = randomUUID()
    const { error } = await upsert_speaker({ dictionary_id: speaker.dictionary_id, speaker, speaker_id: supabase_speaker_id, import_id })
    if (error)
      throw new Error(error.message)

    converted_speakers[firebase_id] = { supabase_id: supabase_speaker_id, speaker }
  }

  fs.writeFileSync(path.resolve(__dirname, FOLDER, 'fb-to-sb-speakers-mapping.json'), JSON.stringify(converted_speakers, null, 2))
}

export async function load_speakers() {
  const speakers = (await import('./firestore-data/fb-to-sb-speakers-mapping.json')).default as AllSpeakerData
  return speakers
}

export function migrate_entries(entries_to_test: any[], speakers: AllSpeakerData) {
  const dictionary_dialects: Record<string, Record<string, string>> = {}
  const dictionary_new_speakers: Record<string, Record<string, string>> = {}
  for (const fb_entry of entries_to_test) {
    migrate_entry(fb_entry, speakers, dictionary_dialects, dictionary_new_speakers)
  }
}

export function migrate_entry(fb_entry: any, speakers: AllSpeakerData, dictionary_dialects: Record<string, Record<string, string>>, dictionary_new_speakers: Record<string, Record<string, string>>) {
  const [processed_fb_entry_remains, supa_data] = convert_entry(JSON.parse(JSON.stringify(fb_entry)))
  if (Object.keys(processed_fb_entry_remains).length > 0) {
    console.log({ fb_entry, processed_fb_entry_remains, supa_data })
    throw new Error('processed_fb_entry_remains not empty')
  }

  const { entry, audio_speakers, audios, dialects, photos, sense_photos, sense_videos, senses, senses_in_sentences, sentences, videos, video_speakers, new_speaker_name, prior_import_id } = supa_data
  const { id: entry_id, dictionary_id } = entry

  let sql_statements = ''

  const sql = insert_entry({
    dictionary_id,
    entry,
    entry_id,
    import_id: prior_import_id || import_id,
  })
  sql_statements += `\n${sql}`

  for (const audio of audios) {
    const sql = upsert_audio({ dictionary_id, entry_id, audio, audio_id: audio.id, import_id })
    sql_statements += `\n${sql}`

    if (new_speaker_name) {
      let new_speaker_id = dictionary_new_speakers[dictionary_id]?.[new_speaker_name]

      if (!new_speaker_id) {
        new_speaker_id = randomUUID()

        const sql = upsert_speaker({ dictionary_id, speaker_id: new_speaker_id, speaker: { name: new_speaker_name, created_at: entry.created_at, created_by: entry.created_by }, import_id })
        sql_statements += `\n${sql}`

        if (!dictionary_new_speakers[dictionary_id])
          dictionary_new_speakers[dictionary_id] = { [new_speaker_name]: new_speaker_id }
        else
          dictionary_new_speakers[dictionary_id] = { ...dictionary_new_speakers[dictionary_id], [new_speaker_name]: new_speaker_id }
      }

      const sql = assign_speaker({
        dictionary_id,
        speaker_id: new_speaker_id,
        media_id: audio.id,
        media: 'audio',
        import_id,
        user_id: entry.created_by,
        timestamp: entry.created_at,
      })
      sql_statements += `\n${sql}`
    }
  }

  for (const audio_speaker of audio_speakers) {
    if (speakers[audio_speaker.speaker_id]) {
      const sql = assign_speaker({
        dictionary_id,
        speaker_id: speakers[audio_speaker.speaker_id].supabase_id,
        media_id: audio_speaker.audio_id,
        media: 'audio',
        import_id,
        user_id: audio_speaker.created_by,
        timestamp: audio_speaker.created_at,
      })
      sql_statements += `\n${sql}`
    } else {
      log_once(`speaker ${audio_speaker.speaker_id} in ${dictionary_id}:${entry_id} not found`)
    }
  }

  for (const dialect of dialects) {
    let dialect_id = dictionary_dialects[dictionary_id]?.[dialect]

    if (!dialect_id) {
      dialect_id = randomUUID()

      const sql = insert_dialect({ dictionary_id, name: dialect, import_id, user_id: entry.created_by, timestamp: entry.created_at, dialect_id })
      sql_statements += `\n${sql}`

      if (!dictionary_dialects[dictionary_id])
        dictionary_dialects[dictionary_id] = { [dialect]: dialect_id }
      else
        dictionary_dialects[dictionary_id] = { ...dictionary_dialects[dictionary_id], [dialect]: dialect_id }
    }

    const sql = assign_dialect({ dictionary_id, dialect_id, entry_id, import_id, user_id: entry.created_by, timestamp: entry.created_at })
    sql_statements += `\n${sql}`
  }

  for (const sense of senses) {
    const sql = insert_sense({ dictionary_id, entry_id, sense, sense_id: sense.id, import_id })
    sql_statements += `\n${sql}`
  }

  for (const sentence of sentences) {
    const { sense_id } = senses_in_sentences.find(s => s.sentence_id === sentence.id)
    if (!sense_id)
      throw new Error('sense_id not found')
    const sql = insert_sentence({ dictionary_id, sense_id, sentence, sentence_id: sentence.id, import_id })
    sql_statements += `\n${sql}`
  }

  for (const photo of photos) {
    const { sense_id } = sense_photos.find(s => s.photo_id === photo.id)
    if (!sense_id)
      throw new Error('sense_id not found')
    const sql = insert_photo({ dictionary_id, sense_id, photo, photo_id: photo.id, import_id })
    sql_statements += `\n${sql}`
  }

  for (const video of videos) {
    const { sense_id } = sense_videos.find(s => s.video_id === video.id)
    if (!sense_id)
      throw new Error('sense_id not found')
    const sql = insert_video({ dictionary_id, sense_id, video, video_id: video.id, import_id })
    sql_statements += `\n${sql}`
  }

  for (const video_speaker of video_speakers) {
    const sql = assign_speaker({
      dictionary_id,
      speaker_id: speakers[video_speaker.speaker_id].supabase_id,
      media_id: video_speaker.video_id,
      media: 'video',
      import_id,
      user_id: video_speaker.created_by,
      timestamp: video_speaker.created_at,
    })
    sql_statements += `\n${sql}`
  }

  return sql_statements
}
