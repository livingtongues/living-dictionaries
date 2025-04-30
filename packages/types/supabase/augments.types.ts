import type { MultiString } from '../gloss.interface'
import type { Coordinates } from '../coordinates.interface'
import type { DictionaryPhoto } from '../photo.interface'
import type { HostedVideo, UnsupportedFields } from '../.'
import type { Change } from './content-update.interface'
import type { ImportContentUpdate } from './content-import.interface'
import type { Orthography } from './orthography.interface'
import type { DictionaryMetadata } from './dictionary.types'

export interface DatabaseAugments {
  public: {
    Tables: {
      content_updates: {
        Row: {
          change: Change | null
          table: string | null
          type: ImportContentUpdate['type'] | null
          data: ImportContentUpdate['data'] | null
        }
        Insert: {
          change?: Change | null
          table?: string | null
          type?: ImportContentUpdate['type'] | null
          data?: ImportContentUpdate['data'] | null
        }
        Update: {
          change?: Change | null
          table?: string | null
          type?: ImportContentUpdate['type'] | null
          data?: ImportContentUpdate['data'] | null
        }
      }
      dialects: {
        Row: {
          name: MultiString
        }
        Insert: {
          name: MultiString
        }
        Update: {
          name: MultiString
        }
      }
      dictionaries: {
        Row: {
          coordinates: Coordinates | null
          featured_image: DictionaryPhoto | null
          metadata: DictionaryMetadata | null
          orthographies: Orthography[] | null
        }
        Insert: {
          coordinates?: Coordinates | null
          featured_image?: DictionaryPhoto | null
          metadata?: DictionaryMetadata | null
          orthographies?: Orthography[] | null
        }
        Update: {
          coordinates?: Coordinates | null
          featured_image?: DictionaryPhoto | null
          metadata?: DictionaryMetadata | null
          orthographies?: Orthography[] | null
        }
      }
      entries: {
        Row: {
          coordinates: Coordinates | null
          lexeme: MultiString
          notes: MultiString | null
          unsupported_fields: UnsupportedFields | null
        }
        Insert: {
          coordinates?: Coordinates | null
          lexeme: MultiString
          notes?: MultiString | null
          unsupported_fields?: UnsupportedFields | null
        }
        Update: {
          coordinates?: Coordinates | null
          lexeme?: MultiString
          notes?: MultiString | null
          unsupported_fields?: UnsupportedFields | null
        }
      }
      senses: {
        Row: {
          definition: MultiString | null
          glosses: MultiString | null
          plural_form: MultiString | null
          variant: MultiString | null
        }
        Insert: {
          definition?: MultiString | null
          glosses?: MultiString | null
          plural_form?: MultiString | null
          variant?: MultiString | null
        }
        Update: {
          definition?: MultiString | null
          glosses?: MultiString | null
          plural_form?: MultiString | null
          variant?: MultiString | null
        }
      }
      sentences: {
        Row: {
          text: MultiString | null
          translation: MultiString | null
        }
        Insert: {
          text?: MultiString | null
          translation?: MultiString | null
        }
        Update: {
          text?: MultiString | null
          translation?: MultiString | null
        }
      }
      texts: {
        Row: {
          sentences: MultiString
          title: MultiString
        }
        Insert: {
          sentences: MultiString
          title: MultiString
        }
        Update: {
          sentences?: MultiString
          title?: MultiString
        }
      }
      videos: {
        Row: {
          hosted_elsewhere: HostedVideo | null
        }
        Insert: {
          hosted_elsewhere?: HostedVideo | null
        }
        Update: {
          hosted_elsewhere?: HostedVideo | null
        }
      }
    }
    Views: {
      dictionaries_view: {
        Row: {
          coordinates: Coordinates | null
          featured_image: DictionaryPhoto | null
          metadata: DictionaryMetadata | null
          orthographies: Orthography[] | null
        }
      }
      materialized_admin_dictionaries_view: {
        Row: {
          coordinates: Coordinates | null
          featured_image: DictionaryPhoto | null
          metadata: DictionaryMetadata | null
          orthographies: Orthography[] | null
        }
      }
      materialized_dictionaries_view: {
        Row: {
          coordinates: Coordinates | null
          metadata: DictionaryMetadata | null
        }
      }
    }
    Functions: {
      get_my_claim: {
        Returns: any
      }
    }
  }
}
