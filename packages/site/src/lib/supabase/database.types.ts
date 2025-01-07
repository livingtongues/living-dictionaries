import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@living-dictionaries/types'

export type Supabase = SupabaseClient<Database>
