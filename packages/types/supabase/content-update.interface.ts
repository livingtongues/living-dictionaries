import type { TablesUpdate } from './combined.types'

export interface Change {
  type: string
  data: Record<string, any>
}

export type ContentUpdateRequestBody =
  | Upsert_Entry
  | Upsert_Dialect
  | Upsert_Sense
  | Insert_Sentence
  | Update_Sentence
  | Remove_Sentence
  | Upsert_Audio
  | Upsert_Photo
  | Upsert_Video

interface ContentUpdateBase {
  update_id: string // id of the change, a uuidv4 created on client to make things idempotent
  user_id_from_local?: string
  auth_token: string
  dictionary_id: string
  import_id?: string
  timestamp: string
}

interface Upsert_Entry extends ContentUpdateBase {
  type: 'upsert_entry'
  data: TablesUpdate<'entries'>
  entry_id: string
}

interface Upsert_Dialect extends ContentUpdateBase {
  type: 'upsert_dialect'
  data: TablesUpdate<'dialects'>
  dialect_id: string
}

interface Upsert_Sense extends ContentUpdateBase {
  type: 'upsert_sense'
  data: TablesUpdate<'senses'>
  sense_id: string
  entry_id: string
}

interface Insert_Sentence extends ContentUpdateBase {
  type: 'insert_sentence'
  data: TablesUpdate<'sentences'>
  sentence_id: string
  sense_id: string
}

interface Update_Sentence extends ContentUpdateBase {
  type: 'update_sentence'
  data: TablesUpdate<'sentences'>
  sentence_id: string
}

/** currently also deletes the sentence - later when a sentence can be connected to multiple senses, use a deleted field to indicate the sentence is deleted everywhere */
interface Remove_Sentence extends ContentUpdateBase {
  type: 'remove_sentence'
  sentence_id: string
  sense_id: string
  data?: null
}

interface Upsert_Audio extends ContentUpdateBase {
  type: 'upsert_audio'
  data: TablesUpdate<'audio'>
  audio_id?: string
  entry_id: string
}

interface Upsert_Photo extends ContentUpdateBase {
  type: 'upsert_photo'
  data: TablesUpdate<'photos'>
  photo_id?: string
  sense_id: string
}

interface Upsert_Video extends ContentUpdateBase {
  type: 'upsert_video'
  data: TablesUpdate<'videos'>
  video_id?: string
  sense_id: string
}
