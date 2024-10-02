import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@living-dictionaries/types'

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
