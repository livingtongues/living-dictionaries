import type { Tables } from '@living-dictionaries/types'
import { convert_entry } from './convert-entries'
import entries_to_test from './entries_to_test.json'
import { assign_dialect, assign_speaker, upsert_audio, upsert_dialect, upsert_entry, upsert_photo, upsert_sense, upsert_sentence, upsert_speaker, upsert_video } from './operations/operations'

const import_id = 'fb_sb_migration'

// TODO: import speakers from Firebase first
async function migrate_entries(speakers: Tables<'speakers'>[]) {
  // TODO: track dictionary-to-dialects already added and store their id
  // TODO: track dictionary-to-speakers already added from new_speaker_name and store their id in a map [dictionary_id--speaker_name]: id

  for (const fb_entry of entries_to_test) {
    const [_, supa_data] = convert_entry(fb_entry as any)
    const { entry, audio_speakers, audios, dialects, photos, sense_photos, sense_videos, senses, senses_in_sentences, sentences, videos, video_speakers, new_speaker_name, prior_import_id } = supa_data
    console.log(supa_data.entry)

    const { id: entry_id, dictionary_id } = entry

    const { error: entry_error } = await upsert_entry({
      dictionary_id,
      entry,
      entry_id,
      import_id: prior_import_id || import_id, // TODO: check the usage of source - need to first see if it starts with `import:`
    })
    if (entry_error)
      throw new Error(entry_error.message)

    for (const audio of audios) {
      const { error } = await upsert_audio({ dictionary_id, entry_id, audio, import_id })
      if (error)
        throw new Error(error.message)

      if (new_speaker_name) {
        const { error: speaker_error } = await upsert_speaker({ dictionary_id, speaker: { name: new_speaker_name }, import_id })
        if (speaker_error)
          throw new Error(speaker_error.message)
      }
    }

    for (const audio_speaker of audio_speakers) {
      const { error } = await assign_speaker({ dictionary_id, speaker_id: audio_speaker.speaker_id, media_id: audio_speaker.audio_id, media: 'audio', import_id })
      if (error)
        throw new Error(error.message)
    }

    for (const dialect of dialects) {
      // TODO: if dialect is not in dialects table, add it:
      const { data, error } = await upsert_dialect({ dictionary_id, name: dialect, import_id })
      if (error)
        throw new Error(error.message)

      const { error: assign_error } = await assign_dialect({ dictionary_id, dialect_id: data.dialect_id, entry_id, import_id })
      if (assign_error)
        throw new Error(assign_error.message)
    }

    for (const sense of senses) {
      const { error } = await upsert_sense({ dictionary_id, entry_id, sense, import_id })
      if (error)
        throw new Error(error.message)
    }

    for (const sentence of sentences) {
      const { sense_id } = senses_in_sentences.find(s => s.sentence_id === sentence.id)
      if (!sense_id)
        throw new Error('sense_id not found')
      const { error } = await upsert_sentence({ dictionary_id, sense_id, sentence, import_id })
      if (error)
        throw new Error(error.message)
    }

    for (const photo of photos) {
      const { sense_id } = sense_photos.find(s => s.photo_id === photo.id)
      if (!sense_id)
        throw new Error('sense_id not found')
      const { error } = await upsert_photo({ dictionary_id, sense_id, photo, import_id })
      if (error)
        throw new Error(error.message)
    }

    for (const video of videos) {
      const { sense_id } = sense_videos.find(s => s.video_id === video.id)
      if (!sense_id)
        throw new Error('sense_id not found')
      const { error } = await upsert_video({ dictionary_id, sense_id, video, import_id })
      if (error)
        throw new Error(error.message)
    }

    for (const video_speaker of video_speakers) {
      const { error } = await assign_speaker({ dictionary_id, speaker_id: video_speaker.speaker_id, media_id: video_speaker.video_id, media: 'video', import_id })
      if (error)
        throw new Error(error.message)
    }
  }
}
