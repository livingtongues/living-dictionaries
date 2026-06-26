import type { TablesInsert, TablesUpdate } from './combined.types'

export interface Change {
  type: string
  data: Record<string, any>
}

export type ContentUpdateRequestBody =
  | Insert_Entry
  | Update_Entry

  | Insert_Sense
  | Update_Sense

  | Upsert_Audio

  | Insert_Photo
  | Update_Photo

  | Insert_Video
  | Update_Video

  | Upsert_Speaker
  | Assign_Speaker

  | Insert_Tag
  | Assign_Tag

  | Insert_Dialect
  | Assign_Dialect

  | Insert_Sentence
  | Update_Sentence

interface ContentUpdateBase {
  update_id: string // id of the change, a uuidv4 created on client to make things idempotent
  dictionary_id: string
  import_id?: string
}

interface Insert_Entry extends ContentUpdateBase {
  type: 'insert_entry'
  data: Omit<TablesInsert<'entries'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id'>
  entry_id: string
}

interface Update_Entry extends ContentUpdateBase {
  type: 'update_entry'
  data: TablesUpdate<'entries'>
  entry_id: string
}

interface Insert_Tag extends ContentUpdateBase {
  type: 'insert_tag'
  data: Omit<TablesInsert<'tags'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id'>
  tag_id?: string
}

interface Assign_Tag extends ContentUpdateBase {
  type: 'assign_tag'
  data?: null | { deleted: string }
  tag_id: string
  entry_id: string
}

interface Insert_Dialect extends ContentUpdateBase {
  type: 'insert_dialect'
  data: Omit<TablesInsert<'dialects'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id'>
  dialect_id?: string
}

interface Assign_Dialect extends ContentUpdateBase {
  type: 'assign_dialect'
  data?: null | { deleted: string }
  dialect_id: string
  entry_id: string
}

interface Upsert_Speaker extends ContentUpdateBase {
  type: 'upsert_speaker'
  data: TablesUpdate<'speakers'>
  speaker_id: string
}

interface Assign_Speaker_Base extends ContentUpdateBase {
  type: 'assign_speaker'
  data?: null | { deleted: string }
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

interface Insert_Sense extends ContentUpdateBase {
  type: 'insert_sense'
  data: Omit<TablesInsert<'senses'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id' | 'entry_id'>
  sense_id: string | null
  entry_id: string
}

interface Update_Sense extends ContentUpdateBase {
  type: 'update_sense'
  data: TablesUpdate<'senses'>
  sense_id: string
}

interface Insert_Sentence extends ContentUpdateBase {
  type: 'insert_sentence'
  data: Omit<TablesInsert<'sentences'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id'>
  sentence_id?: string
  sense_id: string
}

interface Update_Sentence extends ContentUpdateBase {
  type: 'update_sentence'
  data: TablesUpdate<'sentences'>
  sentence_id: string
}

interface Insert_Photo extends ContentUpdateBase {
  type: 'insert_photo'
  data: Omit<TablesInsert<'photos'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id'>
  photo_id?: string
  sense_id: string
}

interface Update_Photo extends ContentUpdateBase {
  type: 'update_photo'
  data: TablesUpdate<'photos'>
  photo_id: string
}

interface Upsert_Audio extends ContentUpdateBase {
  type: 'upsert_audio'
  data: TablesUpdate<'audio'>
  audio_id?: string
  entry_id: string
}

interface Insert_Video extends ContentUpdateBase {
  type: 'insert_video'
  data: Omit<TablesInsert<'videos'>, 'created_by' | 'updated_by' | 'dictionary_id' | 'id'>
  video_id?: string
  sense_id: string
}

interface Update_Video extends ContentUpdateBase {
  type: 'update_video'
  data: TablesUpdate<'videos'>
  video_id: string
}
