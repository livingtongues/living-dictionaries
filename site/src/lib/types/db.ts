import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type * as shared from '$lib/db/schemas/shared'
import type * as dict from '$lib/db/schemas/dictionary'

/**
 * Drizzle is the single source of truth for every data shape. The legacy
 * Supabase-generated `Tables<>` / `TablesInsert<>` / `TablesUpdate<>` helpers are
 * re-implemented here over `InferSelectModel` / `InferInsertModel` so the ~130
 * existing call sites keep working while every shape now comes from the SQLite
 * schemas (`$lib/db/schemas/{shared,dictionary}.ts`).
 */
interface TableModels {
  // shared.db (admin / global catalog)
  dictionaries: typeof shared.dictionaries
  dictionary_roles: typeof shared.dictionary_roles
  dictionary_partners: typeof shared.dictionary_partners
  invites: typeof shared.invites
  users: typeof shared.users
  // dictionaries/<id>.db (per-dictionary content)
  entries: typeof dict.entries
  texts: typeof dict.texts
  senses: typeof dict.senses
  sentences: typeof dict.sentences
  senses_in_sentences: typeof dict.senses_in_sentences
  speakers: typeof dict.speakers
  audio: typeof dict.audio
  audio_speakers: typeof dict.audio_speakers
  videos: typeof dict.videos
  video_speakers: typeof dict.video_speakers
  sense_videos: typeof dict.sense_videos
  sentence_videos: typeof dict.sentence_videos
  photos: typeof dict.photos
  sense_photos: typeof dict.sense_photos
  sentence_photos: typeof dict.sentence_photos
  dialects: typeof dict.dialects
  entry_dialects: typeof dict.entry_dialects
  tags: typeof dict.tags
  entry_tags: typeof dict.entry_tags
  sources: typeof dict.sources
}

export type Tables<T extends keyof TableModels | 'dictionaries_view'>
  = T extends 'dictionaries_view' ? DictionaryView
    : T extends keyof TableModels ? InferSelectModel<TableModels[T]>
      : never

export type TablesInsert<T extends keyof TableModels> = InferInsertModel<TableModels[T]>

export type TablesUpdate<T extends keyof TableModels> = Partial<InferInsertModel<TableModels[T]>>

/**
 * Catalog projection consumed by the globe / list / footer / CSV export. The
 * catalog row already carries everything (including the long-form `about` /
 * `grammar` / `citation` folded from the legacy `dictionary_info`); the
 * `created_by` / `updated_by` aliases are added by the server projection
 * (`db/server/get-dictionaries-catalog.ts`).
 */
export type DictionaryView = InferSelectModel<typeof shared.dictionaries> & {
  created_by?: string | null
  updated_by?: string | null
}
