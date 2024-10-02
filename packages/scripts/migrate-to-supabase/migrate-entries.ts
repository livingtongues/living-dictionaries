import { convert_entry } from './convert-entries'
import entries_to_test from './entries_to_test.json'
import { upsert_entry, upsert_sense } from './operations/operations'

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

    for (const sense of senses) {
      const { error } = await upsert_sense({ dictionary_id, entry_id, sense, import_id })
      if (error)
        throw new Error(error.message)
    }

    for (const audio of audios) {
      // TODO - add (match updated_at field to created_at)
      // TODO - connect to entry
    }

    for (const audio_speaker of audio_speakers) {
      // TODO - connect
      // import speakers also?
    }
  }
}

migrate_entries()
