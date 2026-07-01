import type { EntryFieldValue } from './entry-fields.enum'

export interface IColumn {
  field: EntryFieldValue
  width: number
  sticky?: boolean
  hidden?: boolean

  display?: string // for gloss, exampleSentences and alternateOrthographies added later
  explanation?: string // e.g. show vernacular language title on hover instead of current language title for that particular gloss language
  orthography_code?: string // the alternate orthography's immutable lexeme key
  bcp?: string
}
