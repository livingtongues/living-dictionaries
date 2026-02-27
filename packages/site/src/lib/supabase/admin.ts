import type { Database } from '@living-dictionaries/types'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import { PUBLIC_SUPABASE_API_URL } from '$env/static/public'
import { createClient } from '@supabase/supabase-js'

export function getAdminSupabaseClient() {
  return createClient<Database>(PUBLIC_SUPABASE_API_URL, SUPABASE_SERVICE_ROLE_KEY)
}
