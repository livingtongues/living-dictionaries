export type { DictionaryView, Tables, TablesInsert, TablesUpdate } from './db'
export type { EntryData } from './entry.interface'
export type { HostedVideo, VideoCustomMetadata } from './video.interface'
export type { Coordinates, IPoint, IRegion, LngLatFull } from './coordinates.interface'
export type { IGlossLanguage, IGlossLanguages } from './gloss-language.interface'
export type { MultiString } from './gloss.interface'
export type { IExampleSentence } from './example-sentence.interface'
export type { DictionaryPhoto, PartnerPhoto } from './photo.interface'
export type { SemanticDomain } from './semantic-domain.interface'
export type { GoogleAuthUserMetaData } from './user.interface'
export type { PartOfSpeech } from './part-of-speech.interface'
export type { IColumn } from './column.interface'
export { type IPrintFields, StandardPrintFields } from './print-entry.interface'
export { type EntryFieldValue, type i18nEntryFieldKey } from './entry-fields.enum'
export type { ContentUpdateRequestBody } from './content-update.interface'
export type { UnsupportedFields } from './unsupported.interface'
export type { Orthography } from './orthography.interface'

export interface PartnerWithPhoto {
  id: string
  name: string
  photo?: {
    id: string
    storage_path: string
    serving_url: string
  }
}
