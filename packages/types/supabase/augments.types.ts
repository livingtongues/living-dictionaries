import type { MultiString } from '../gloss.interface'
import type { Coordinates } from '../coordinates.interface'
import type { DictionaryPhoto } from '../photo.interface'
import type { HostedVideo, SenseWithSentences, UnsupportedFields } from '../.'
import type { Change } from './content-update.interface'

export interface DatabaseAugments {
  public: {
    Tables: {
      content_updates: {
        Row: {
          change: Change
          table: string | null
        }
        Insert: {
          change: Change
          table?: string | null
        }
        Update: {
          change?: Change
          table?: string | null
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
          metadata: Record<string, string> | null
          orthographies: any[] | null
        }
        Insert: {
          coordinates?: Coordinates | null
          featured_image?: DictionaryPhoto | null
          metadata?: Record<string, string> | null
          orthographies?: any[] | null
        }
        Update: {
          coordinates?: Coordinates | null
          featured_image?: DictionaryPhoto | null
          metadata?: Record<string, string> | null
          orthographies?: any[] | null
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
      entries_view: {
        Row: {
          // @ts-expect-error
          main: Tables<'entries'>
          senses: SenseWithSentences[] | null
          // @ts-expect-error
          audios: Tables<'audio'>[] | null
          dialect_ids: string[] | null
        }
      }
    }
  }
}
