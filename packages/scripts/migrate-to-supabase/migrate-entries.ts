import { convert_entry } from './convert-entries'
import entries_to_test from './entries_to_test.json'
import { upsert_audio, upsert_dialect, upsert_entry, upsert_photo, upsert_sense, upsert_sentence, upsert_video } from './operations/operations'

const import_id = 'fb_sb_migration'

async function migrate_entries() {
  // track dictionary-to-dialects already added and store their id
  // track dictionary-to-speakers already added and store their id in a map [dictionary_id--speaker_name]: id

  for (const fb_entry of entries_to_test) {
    const [_, supa_data] = convert_entry(fb_entry as any)
    const { entry, audio_speakers, audios, dialects, photos, sense_photos, sense_videos, senses, senses_in_sentences, sentences, videos, new_speaker_name, prior_import_id } = supa_data
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
    }

    // TODO: import speakers from Firebase first
    for (const audio_speaker of audio_speakers) {
      // TODO: connect
    }

    for (const dialect of dialects) {
      // TODO: if dialect is not in dialects table, add it:
      const { error } = await upsert_dialect({ dictionary_id, name: dialect, import_id })
      if (error)
        throw new Error(error.message)

      // TODO: connect dialect to entry
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
  }
}

migrate_entries()
