import type { Tables } from './supabase/combined.types'

export type { EntryData } from './supabase/entry.interface'
export type { VideoCustomMetadata, HostedVideo } from './video.interface'
export type { Coordinates, IPoint, IRegion } from './coordinates.interface'
export type { IGlossLanguages, IGlossLanguage } from './gloss-language.interface'
export type { MultiString } from './gloss.interface'
export type { IExampleSentence } from './example-sentence.interface'
export type { DictionaryPhoto } from './photo.interface'
export type { SemanticDomain } from './semantic-domain.interface'
export type { GoogleAuthUserMetaData } from './user.interface'
export type { PartOfSpeech } from './part-of-speech.interface'
export type { IColumn } from './column.interface'
export { type IPrintFields, StandardPrintFields } from './print-entry.interface'
export { type EntryFieldValue, type i18nEntryFieldKey } from './entry-fields.enum'
export type { ContentUpdateRequestBody } from './supabase/content-update.interface'
export type { UnsupportedFields } from './supabase/unsupported.interface'
export type { Database, Tables, TablesInsert, TablesUpdate } from './supabase/combined.types'
export type { Orthography } from './supabase/orthography.interface'

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
