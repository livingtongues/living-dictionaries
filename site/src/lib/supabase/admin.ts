import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@living-dictionaries/types'
import { create_stub_supabase_client } from './stub-client'

// vps-migration M1: server admin (service-role) client stubbed — no Supabase env.
export function getAdminSupabaseClient(): SupabaseClient<Database> {
  return create_stub_supabase_client()
}
