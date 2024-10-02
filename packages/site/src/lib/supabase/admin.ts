import { createClient } from '@supabase/supabase-js'
import type { Database } from '@living-dictionaries/types'
import { PUBLIC_SUPABASE_API_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'

export function getAdminSupabaseClient() {
  return createClient<Database>(PUBLIC_SUPABASE_API_URL, SUPABASE_SERVICE_ROLE_KEY)
}
