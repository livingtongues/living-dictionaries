import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database as DatabaseGenerated } from './generated.types'

export type Database = DatabaseGenerated
export type Supabase = SupabaseClient<Database>

