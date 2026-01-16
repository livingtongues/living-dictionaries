import type { Tables } from './supabase/combined.types'

export type { IColumn } from './column.interface'
export type { Coordinates, IPoint, IRegion } from './coordinates.interface'
export { type EntryFieldValue, type i18nEntryFieldKey } from './entry-fields.enum'
export type { IExampleSentence } from './example-sentence.interface'
export type { IGlossLanguage, IGlossLanguages } from './gloss-language.interface'
export type { MultiString } from './gloss.interface'
export type { PartOfSpeech } from './part-of-speech.interface'
export type { DictionaryPhoto } from './photo.interface'
export { type IPrintFields, StandardPrintFields } from './print-entry.interface'
export type { SemanticDomain } from './semantic-domain.interface'
export type { Database, Tables, TablesInsert, TablesUpdate } from './supabase/combined.types'
export type { ContentUpdateRequestBody } from './supabase/content-update.interface'
export type { EntryData } from './supabase/entry.interface'
export type { Orthography } from './supabase/orthography.interface'
export type { UnsupportedFields } from './supabase/unsupported.interface'
export type { GoogleAuthUserMetaData } from './user.interface'
export type { HostedVideo, VideoCustomMetadata } from './video.interface'

export type DictionaryView = Tables<'dictionaries_view'>
export interface PartnerWithPhoto {
  id: string
  name: string
  photo: {
    id: string
    storage_path: string
    serving_url: string
  }
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
}
