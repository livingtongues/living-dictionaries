import type { SupabaseClient } from '@supabase/supabase-js'
import type { Merge } from 'type-fest'
import type { DatabaseGenerated, MultiString, Tables } from '@living-dictionaries/types'

export type Database = DatabaseGenerated
// export type Database = MergeDeep<DatabaseGenerated, {
//   public: {
//     Tables: {
//       content_updates: {
//         Row: {
//           change: Change
//         },
//         Insert: {
//           change: Change
//         }
//       }
//       dictionaries: {
//         Row: {
//           coordinates: Coordinates,
//           featured_image: DictionaryPhoto,
//           metadata: Record<string, string>,
//           orthographies: any[],
//         },
//         // Insert: {}
//         // Update: {}
//       }
//       entries: {
//         Row: {
//           lexeme: MultiString
//           coordinates?: Coordinates
//         }
//         Insert: {
//           lexeme: MultiString
//           coordinates?: Coordinates
//         }
//         Update: {
//           lexeme?: MultiString
//           coordinates?: Coordinates
//         }
//       }
//       senses: {
//         Row: {
//           glosses: MultiString
//           definition?: MultiString
//         }
//         Insert: {
//           glosses?: MultiString
//           definition?: MultiString
//         }
//         Update: {
//           glosses?: MultiString
//         }
//       }
//       sentences: {
//         Row: {
//           text?: MultiString
//           translation?: MultiString
//         }
//         Insert: {
//           text?: MultiString
//           translation?: MultiString
//         }
//         Update: {
//           text?: MultiString
//           translation?: MultiString
//         }
//       }
//     }
//     Views: {
//       entries_view: {
//         Row: {
//           id: string | null
//           senses: SupaSense[] | null
//         }
//       }
//     }
//   }
// }>
export type Supabase = SupabaseClient<Database>

export interface GoogleAuthUserMetaData {
  // "iss": string,
  // "sub": string,
  // "name": string,
  // "email": string,
  // "picture": string, // duplicate of avatar_url
  full_name?: string
  avatar_url?: string
  // "provider_id": string,
  // "email_verified": boolean,
  // "phone_verified": boolean
}

export type SupaEntry = Merge<Tables<'entries_view'>, { senses: SupaSense[] }>
// export type SupaEntry = Database['public']['Views']['entries_view']['Row']

export interface SupaSense {
  id: string
  glosses?: MultiString
  parts_of_speech?: string[]
  semantic_domains?: string[]
  write_in_semantic_domains?: string[]
  noun_class?: string
  definition?: MultiString // these will not exist until the Firestore migration; works same as glosses, based on language - right now only have English ones in db
  sentences?: Sentence[]
}

export interface Sentence {
  id: string
  text: MultiString
  translation: MultiString
}
