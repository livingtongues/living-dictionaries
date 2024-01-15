import { PUBLIC_SUPABASE_API_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export function getAdminSupabaseClient() {
  return createClient<Database>(PUBLIC_SUPABASE_API_URL, SUPABASE_SERVICE_ROLE_KEY)
}
