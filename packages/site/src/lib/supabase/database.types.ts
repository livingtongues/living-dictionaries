import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database as DatabaseGenerated, Tables } from './generated.types'
import type { Merge } from 'type-fest'
import type { IGloss } from '@living-dictionaries/types'

export type Database = DatabaseGenerated
// export type Database = MergeDeep<DatabaseGenerated, {
//   public: {
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
  full_name?: string,
  avatar_url?: string,
  // "provider_id": string,
  // "email_verified": boolean,
  // "phone_verified": boolean
}

export type SupaEntry = Merge<Tables<'entries_view'>, { senses: SupaSense[]}>

export interface SupaSense {
  id: string;
  glosses?: IGloss;
  parts_of_speech?: string[];
  semantic_domains?: string[];
  write_in_semantic_domains?: string[];
  noun_class?: string;
  definition?: IGloss; // these will not exist until the Firestore migration; works same as glosses, based on language - right now only have English ones in db
  sentences?: Sentence[];
}

export interface Sentence {
  id: string;
  text: string;
  translation: IGloss;
}
