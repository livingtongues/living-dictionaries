import type { TablesInsert } from './combined.types'

export type ImportContentUpdate =
  | Insert_Entry
  | Insert_Sense
  | Insert_Audio // used Upsert_Audio in migration
  | Insert_Photo
  | Insert_Video
  | Insert_Speaker // used Upsert_Speaker in migration
  | Assign_Speaker
  | Insert_Dialect
  | Assign_Dialect
  | Insert_Sentence

interface Insert_Entry {
  type: 'insert_entry'
  data: Omit<TablesInsert<'entries'>, 'dictionary_id' | 'id'>
  entry_id: string
}

interface Insert_Dialect {
  type: 'insert_dialect'
  data: Omit<TablesInsert<'dialects'>, 'updated_by' | 'dictionary_id' | 'id'>
  dialect_id: string
}

interface Assign_Dialect {
  type: 'assign_dialect'
  data: { created_by: string, created_at: string }
  dialect_id: string
  entry_id: string
}

interface Insert_Speaker {
  type: 'insert_speaker'
  data: Omit<TablesInsert<'speakers'>, 'updated_by' | 'dictionary_id' | 'id'>
  speaker_id: string
}

interface Assign_Speaker_Base {
  type: 'assign_speaker'
  data: { created_by: string, created_at: string }
  speaker_id: string
}

interface Assign_Speaker_With_Audio extends Assign_Speaker_Base {
  audio_id: string
  video_id?: never
}

interface Assign_Speaker_With_Video extends Assign_Speaker_Base {
  video_id: string
  audio_id?: never
}

type Assign_Speaker = Assign_Speaker_With_Audio | Assign_Speaker_With_Video

interface Insert_Sense {
  type: 'insert_sense'
  data: Omit<TablesInsert<'senses'>, 'dictionary_id' | 'id' | 'entry_id'>
  sense_id: string | null
  entry_id: string
}

interface Insert_Sentence {
  type: 'insert_sentence'
  data: Omit<TablesInsert<'sentences'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id'>
  sentence_id: string
  sense_id: string
}

interface Insert_Photo {
  type: 'insert_photo'
  data: Omit<TablesInsert<'photos'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id'>
  photo_id: string
  sense_id: string
}

interface Insert_Audio {
  type: 'insert_audio'
  data: Omit<TablesInsert<'audio'>, 'updated_by' | 'dictionary_id' | 'id'>
  audio_id: string
  entry_id: string
}

interface Insert_Video {
  type: 'insert_video'
  data: Omit<TablesInsert<'videos'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id'>
  video_id: string
  sense_id: string
}
