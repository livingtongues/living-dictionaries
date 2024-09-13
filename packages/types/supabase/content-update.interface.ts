import type { Merge } from 'type-fest'
import type { MultiString } from '../.'
import type { Database, TablesInsert } from './generated.types'

export interface ContentUpdateRequestBody {
  id: string // id of the change, a uuidv4 created on client to make things idempotent
  user_id_from_local?: string
  auth_token: string
  dictionary_id: string
  entry_id?: string
  sense_id?: string
  sentence_id?: string
  text_id?: string
  audio_id?: string
  video_id?: string
  photo_id?: string
  speaker_id?: string
  dialect_id?: string
  table: Database['public']['Enums']['content_tables']
  change?: {
    sense?: {
      glosses?: {
        new: MultiString
        old?: MultiString
      }
      definition?: {
        new: MultiString
        old?: MultiString
      }
      noun_class?: {
        new: string
        old?: string
      }
      parts_of_speech?: {
        new: string[]
        old?: string[]
      }
      semantic_domains?: {
        new: string[]
        old?: string[]
      }
      write_in_semantic_domains?: {
        new: string[]
        old?: string[]
      }
      deleted?: boolean
    }
    sentence?: {
      text?: {
        new: MultiString
        old?: MultiString
      }
      translation?: {
        new: MultiString
        old?: MultiString
      }
      removed_from_sense?: boolean // currently also deletes the sentence - later when a sentence can be connected to multiple senses, use a deleted field to indicate the sentence is deleted everywhere
      // deleted?: boolean;
    }
  }
  addition?: {
    dialects?: Merge<TablesInsert<'dialects'>, { name: MultiString }>
  }
  import_id?: string
  timestamp: string
}
