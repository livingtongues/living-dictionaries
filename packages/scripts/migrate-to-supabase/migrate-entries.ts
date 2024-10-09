import { randomUUID } from 'node:crypto'
import type { ISpeaker, TablesUpdate } from '@living-dictionaries/types'
import { convert_entry } from './convert-entries'
import { assign_dialect, assign_speaker, insert_sentence, upsert_audio, upsert_dialect, upsert_entry, upsert_photo, upsert_sense, upsert_speaker, upsert_video } from './operations/operations'
import { convert_speaker } from './convert-speakers'
import { log_once } from './log-once'

const import_id = 'fb_sb_migration'

export type AllSpeakerData = Record<string, { supabase_id: string, speaker: TablesUpdate<'speakers'> }>

export async function migrate_speakers(firebase_speakers: ISpeaker[]) {
  const converted_speakers: AllSpeakerData = {}

  for (const fb_speaker of firebase_speakers) {
    const { id: firebase_id, speaker } = convert_speaker(JSON.parse(JSON.stringify(fb_speaker)))
    const jacob_test_speaker_id = '2PELJgjxMHXEOcuZfv9MtGyiXdE3'
    if (firebase_id === jacob_test_speaker_id)
      continue

    const supabase_id = randomUUID()
    const { error } = await upsert_speaker({ dictionary_id: speaker.dictionary_id, speaker, speaker_id: supabase_id, import_id })
    if (error)
      throw new Error(error.message)

    converted_speakers[firebase_id] = { supabase_id, speaker }
  }

  return converted_speakers
}

export async function migrate_entries(entries_to_test: any[], speakers: AllSpeakerData) {
  const dictionary_dialects: Record<string, Record<string, string>> = {}
  const dictionary_new_speakers: Record<string, Record<string, string>> = {}
  for (const fb_entry of entries_to_test) {
    await migrate_entry(fb_entry, speakers, dictionary_dialects, dictionary_new_speakers)
  }
}

export async function migrate_entry(fb_entry: any, speakers: AllSpeakerData, dictionary_dialects: Record<string, Record<string, string>>, dictionary_new_speakers: Record<string, Record<string, string>>) {
  const [processed_fb_entry_remains, supa_data] = convert_entry(JSON.parse(JSON.stringify(fb_entry)))
  if (Object.keys(processed_fb_entry_remains).length > 0) {
    console.log({ fb_entry, processed_fb_entry_remains, supa_data })
    throw new Error('processed_fb_entry_remains not empty')
  }

  const { entry, audio_speakers, audios, dialects, photos, sense_photos, sense_videos, senses, senses_in_sentences, sentences, videos, video_speakers, new_speaker_name, prior_import_id } = supa_data

  const { id: entry_id, dictionary_id } = entry

  const { error: entry_error } = await upsert_entry({
    dictionary_id,
    entry,
    entry_id,
    import_id: prior_import_id || import_id,
  })
  if (entry_error)
    throw new Error(entry_error.message)

  for (const audio of audios) {
    const { error } = await upsert_audio({ dictionary_id, entry_id, audio, audio_id: audio.id, import_id })
    if (error)
      throw new Error(error.message)

    if (new_speaker_name) {
      let new_speaker_id = dictionary_new_speakers[dictionary_id]?.[new_speaker_name]

      if (!new_speaker_id) {
        const { data, error: speaker_error } = await upsert_speaker({ dictionary_id, speaker: { name: new_speaker_name, created_at: entry.created_at, created_by: entry.created_by }, import_id })
        if (speaker_error)
          throw new Error(speaker_error.message)

        if (!dictionary_new_speakers[dictionary_id])
          dictionary_new_speakers[dictionary_id] = { [new_speaker_name]: data.speaker_id }
        else
          dictionary_new_speakers[dictionary_id] = { ...dictionary_new_speakers[dictionary_id], [new_speaker_name]: data.speaker_id };
        ({ speaker_id: new_speaker_id } = data)
      }
      const { error: assign_error } = await assign_speaker({
        dictionary_id,
        speaker_id: new_speaker_id,
        media_id: audio.id,
        media: 'audio',
        import_id,
        user_id: entry.created_by,
        timestamp: entry.created_at,
      })
      if (assign_error)
        throw new Error(assign_error.message)
    }
  }

  for (const audio_speaker of audio_speakers) {
    if (speakers[audio_speaker.speaker_id]) {
      const { error } = await assign_speaker({
        dictionary_id,
        speaker_id: speakers[audio_speaker.speaker_id].supabase_id,
        media_id: audio_speaker.audio_id,
        media: 'audio',
        import_id,
        user_id: audio_speaker.created_by,
        timestamp: audio_speaker.created_at,
      })
      if (error)
        throw new Error(error.message)
    } else {
      log_once(`speaker ${audio_speaker.speaker_id} in ${dictionary_id}:${entry_id} not found`)
    }
  }

  for (const dialect of dialects) {
    let dialect_id = dictionary_dialects[dictionary_id]?.[dialect]

    if (!dialect_id) {
      const { data, error } = await upsert_dialect({ dictionary_id, name: dialect, import_id, user_id: entry.created_by, timestamp: entry.created_at })
      if (error)
        throw new Error(error.message)

      if (!dictionary_dialects[dictionary_id])
        dictionary_dialects[dictionary_id] = { [dialect]: data.dialect_id }
      else
        dictionary_dialects[dictionary_id] = { ...dictionary_dialects[dictionary_id], [dialect]: data.dialect_id };
      ({ dialect_id } = data)
    }

    const { error: assign_error } = await assign_dialect({ dictionary_id, dialect_id, entry_id, import_id, user_id: entry.created_by, timestamp: entry.created_at })
    if (assign_error) {
      throw new Error(assign_error.message)
    }
  }

  for (const sense of senses) {
    const { error } = await upsert_sense({ dictionary_id, entry_id, sense, sense_id: sense.id, import_id })
    if (error)
      throw new Error(error.message)
  }

  for (const sentence of sentences) {
    const { sense_id } = senses_in_sentences.find(s => s.sentence_id === sentence.id)
    if (!sense_id)
      throw new Error('sense_id not found')
    const { error } = await insert_sentence({ dictionary_id, sense_id, sentence, sentence_id: sentence.id, import_id })
    if (error)
      throw new Error(error.message)
  }

  for (const photo of photos) {
    const { sense_id } = sense_photos.find(s => s.photo_id === photo.id)
    if (!sense_id)
      throw new Error('sense_id not found')
    const { error } = await upsert_photo({ dictionary_id, sense_id, photo, photo_id: photo.id, import_id })
    if (error)
      throw new Error(error.message)
  }

  for (const video of videos) {
    const { sense_id } = sense_videos.find(s => s.video_id === video.id)
    if (!sense_id)
      throw new Error('sense_id not found')
    const { error } = await upsert_video({ dictionary_id, sense_id, video, video_id: video.id, import_id })
    if (error)
      throw new Error(error.message)
  }

  for (const video_speaker of video_speakers) {
    const { error } = await assign_speaker({
      dictionary_id,
      speaker_id: speakers[video_speaker.speaker_id].supabase_id,
      media_id: video_speaker.video_id,
      media: 'video',
      import_id,
      user_id: video_speaker.created_by,
      timestamp: video_speaker.created_at,
    })
    if (error)
      throw new Error(error.message)
  }
}
