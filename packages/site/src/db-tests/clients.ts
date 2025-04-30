import type { Database } from '@living-dictionaries/types'
import { createClient } from '@supabase/supabase-js'

// local keys from .env.development - ok to commit
export const PUBLIC_SUPABASE_API_URL = 'http://127.0.0.1:54321'
export const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
export const PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export const admin_supabase = createClient<Database>(PUBLIC_SUPABASE_API_URL, SUPABASE_SERVICE_ROLE_KEY)
export const anon_supabase = createClient<Database>(PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY)

export const uuid_template = '11111111-1111-1111-1111-111111111111'
