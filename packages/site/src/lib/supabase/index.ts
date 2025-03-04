import { type AuthResponse, type SupabaseClient, createClient } from '@supabase/supabase-js'
import type { Database } from '@living-dictionaries/types'
import { PUBLIC_MODE, PUBLIC_STUDIO_URL, PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_API_URL } from '$env/static/public'

// https://supabase.com/docs/reference/javascript/typescript-support
export type Supabase = SupabaseClient<Database>
export const mode = PUBLIC_MODE as 'development' | 'production'

const browser = typeof window !== 'undefined'
let supabase: Supabase | undefined

// return a unique instance on server, but a shared instance on client
// runs in hooks for easy use in api and server data fetching
// runs in +layout.ts for isomorphic use in pages
// the result is that on the server, two clients are created with the same auth - it's not a race condition issue but it's not ideal, however we can't just do it once because we can't pass it to +layout.ts from +layout.server.ts
export function getSupabase() {
  if (browser && supabase)
    return supabase

  console.info(`creating Supabase client: ${PUBLIC_STUDIO_URL}`)
  const _supabase = createClient<Database>(PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: browser } })

  if (browser)
    supabase = _supabase

  return _supabase
}

const NULL_RESPONSE = {
  data: {
    user: null,
    session: null,
  },
  error: { message: 'no session' },
} as AuthResponse

export async function getSession({ supabase, access_token, refresh_token }: { supabase: Supabase, access_token: string, refresh_token: string }) {
  if (!access_token || !refresh_token)
    return NULL_RESPONSE

  const authResponse = await supabase.auth.setSession({ access_token, refresh_token })
  return authResponse
}
