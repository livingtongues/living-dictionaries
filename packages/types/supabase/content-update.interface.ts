import type { TablesUpdate } from './combined.types'

export interface Change {
  type: string
  data: Record<string, any>
}

export type ContentUpdateRequestBody =
  | Upsert_Entry
  | Upsert_Sense
  | Upsert_Audio
  | Upsert_Photo
  | Upsert_Video

  | Upsert_Speaker
  | Assign_Speaker
  | Unassign_Speaker

  | Upsert_Dialect
  | Assign_Dialect
  | Unassign_Dialect

  | Insert_Sentence
  | Update_Sentence
  | Remove_Sentence

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

interface Assign_Dialect extends ContentUpdateBase {
  type: 'assign_dialect'
  data?: null
  dialect_id: string
  entry_id: string
}

interface Unassign_Dialect extends ContentUpdateBase {
  type: 'unassign_dialect'
  data?: null
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
  data?: null
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

interface Unassign_Speaker extends ContentUpdateBase {
  type: 'unassign_speaker'
  data: { media: 'audio' | 'video' }
  speaker_id: string
  media_id: string
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
