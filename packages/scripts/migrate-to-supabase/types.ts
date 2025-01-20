import type { DictionaryPhoto, IFirestoreMetaData } from '@living-dictionaries/types'
import type { IPoint, IRegion, LngLatFull } from '@living-dictionaries/types/coordinates.interface'

export interface IDictionary extends IFirestoreMetaData {
  allContribute?: boolean // deprecated
  alternateNames?: string[]
  glossLanguages: string[]
  name: string
  location?: string
  iso6393?: string
  glottocode?: string

  coordinates?: {
    _longitude: number
    _latitude: number
  } | LngLatFull // primary coordinate when displayed w/ many other dictionaries
  points?: IPoint[] // other coordinate points where language spoken
  regions?: IRegion[] // regions where language spoken

  public?: boolean
  printAccess?: boolean
  entryCount?: number // number | FieldValue;
  copyright?: string // Allow custom copyright in case "Copyright _______ community" isn't appropriate for dictionary (eg. Tehuelche)
  alternateOrthographies?: string[] // Alternate Orthography titles (first item corresponds to entry.lo, then entry.lo2, entry.lo3) - used to be called Local Orthography but that is a misnomer it's turning out

  videoAccess?: boolean // deprecated

  languageUsedByCommunity?: boolean
  communityPermission?: 'yes' | 'no' | 'unknown'
  authorConnection?: string
  conLangDescription?: string

  featuredImage?: DictionaryPhoto
  hideLivingTonguesLogo?: boolean

  // tdv1 (old Talking Dictionaries platform at Swarthmore)
  publishYear?: number
  population?: number
  thumbnail?: string
  url?: string
  type?: 'tdv1'
}
