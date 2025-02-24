import { randomUUID } from 'node:crypto'
import type { TablesInsert, TablesUpdate } from '@living-dictionaries/types'
import { prepare_sql } from '../save-content-update'

export function insert_entry({
  dictionary_id,
  entry,
  entry_id,
  import_id,
}: {
  dictionary_id: string
  entry: Omit<TablesInsert<'entries'>, 'dictionary_id' | 'id'>
  entry_id: string
  import_id: string
}) {
  return prepare_sql({
    update_id: randomUUID(),

    dictionary_id,
    entry_id,
    type: 'insert_entry',
    data: entry,
    import_id,
  })
}

export function insert_sense({
  dictionary_id,
  entry_id,
  sense,
  sense_id,
  import_id,
}: {
  dictionary_id: string
  entry_id: string
  sense: Omit<TablesInsert<'senses'>, 'dictionary_id' | 'id' | 'entry_id'>
  sense_id: string
  import_id: string
}) {
  return prepare_sql({
    update_id: randomUUID(),

    dictionary_id,
    entry_id,
    sense_id,
    type: 'insert_sense',
    data: sense,
    import_id,
  })
}

export function insert_dialect({
  dictionary_id,
  name,
  dialect_id,
  import_id,
  user_id,
  timestamp,
}: {
  dictionary_id: string
  name: string
  dialect_id: string
  import_id: string
  user_id: string
  timestamp: string
}) {
  return prepare_sql({
    update_id: randomUUID(),

    dictionary_id,
    dialect_id,
    type: 'insert_dialect',
    data: {
      name: {
        default: name,
      },
      created_by: user_id,
      created_at: timestamp,
    },
    import_id,
  })
}

export function assign_dialect({
  dictionary_id,
  dialect_id,
  entry_id,
  import_id,
  user_id,
  timestamp,
}: {
  dictionary_id: string
  dialect_id: string
  entry_id: string
  import_id: string
  user_id: string
  timestamp: string
}) {
  return prepare_sql({
    update_id: randomUUID(),

    dictionary_id,
    dialect_id,
    entry_id,
    type: 'assign_dialect',
    data: {
      created_by: user_id,
      created_at: timestamp,
    },
    import_id,
  })
}

export function upsert_speaker({
  dictionary_id,
  speaker,
  speaker_id,
  import_id,
}: {
  dictionary_id: string
  speaker: Omit<TablesInsert<'speakers'>, 'updated_by' | 'dictionary_id' | 'id'>
  speaker_id: string
  import_id: string
}) {
  return prepare_sql({
    update_id: randomUUID(),

    dictionary_id,
    speaker_id,
    type: 'upsert_speaker',
    data: speaker,
    import_id,
  })
}

export function assign_speaker({
  dictionary_id,
  speaker_id,
  media_id,
  media,
  import_id,
  user_id,
  timestamp,
}: {
  dictionary_id: string
  speaker_id: string
  media_id: string
  media: 'audio' | 'video'
  import_id: string
  user_id: string
  timestamp: string
}) {
  return prepare_sql({
    update_id: randomUUID(),

    data: {
      created_by: user_id,
      created_at: timestamp,
    },
    dictionary_id,
    speaker_id,
    ...(media === 'audio' ? { audio_id: media_id } : { video_id: media_id }),
    type: 'assign_speaker',
    import_id,
  })
}

export function upsert_audio({
  dictionary_id,
  audio,
  entry_id,
  audio_id,
  import_id,
}: {
  dictionary_id: string
  audio: Omit<TablesInsert<'audio'>, 'updated_by' | 'dictionary_id' | 'id'>
  entry_id: string
  audio_id: string
  import_id: string
}) {
  return prepare_sql({
    update_id: randomUUID(),

    dictionary_id,
    entry_id,
    audio_id,
    type: 'upsert_audio',
    data: audio,
    import_id,
  })
}

export function insert_sentence({
  dictionary_id,
  sense_id,
  sentence,
  sentence_id,
  import_id,
}: {
  dictionary_id: string
  sense_id: string
  sentence: TablesInsert<'sentences'>
  sentence_id: string
  import_id: string
}) {
  return prepare_sql({
    update_id: randomUUID(),

    dictionary_id,
    sentence_id,
    sense_id,
    type: 'insert_sentence',
    data: sentence,
    import_id,
  })
}

export function insert_photo({
  dictionary_id,
  photo,
  sense_id,
  photo_id,
  import_id,
}: {
  dictionary_id: string
  photo: Omit<TablesInsert<'photos'>, 'updated_by' | 'dictionary_id' | 'id'>
  sense_id: string
  photo_id: string
  import_id: string
}) {
  return prepare_sql({
    update_id: randomUUID(),

    dictionary_id,
    sense_id,
    photo_id,
    type: 'insert_photo',
    data: photo,
    import_id,
  })
}

export function insert_video({
  dictionary_id,
  video,
  sense_id,
  video_id,
  import_id,
}: {
  dictionary_id: string
  video: TablesUpdate<'videos'>
  sense_id: string
  video_id: string
  import_id: string
}) {
  return prepare_sql({
    update_id: randomUUID(),

    dictionary_id,
    sense_id,
    video_id,
    type: 'insert_video',
    data: video,
    import_id,
  })
}
