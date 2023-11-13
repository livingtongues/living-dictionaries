import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_API_URL } from '$env/static/public'
import { createClient, type SupabaseClient, type AuthResponse } from '@supabase/supabase-js'

// import type { Database } from '../DatabaseDefinitions' // https://supabase.com/docs/reference/javascript/typescript-support

const browser = typeof window !== 'undefined'
let supabase: SupabaseClient | undefined

// return a unique instance on server, but a shared instance on client
// runs in hooks for easy use in api and server data fetching
// runs in +layout.ts for isomorphic use in pages
// the result is that on the server, two clients are created with the same auth - it's not a race condition issue but it's not ideal, however we can't just do it once because we can't pass it to +layout.ts from +layout.server.ts
export function getSupabase() {
  const [origin] = PUBLIC_SUPABASE_API_URL.split('.')
  const [, supabaseId] = origin.split('//')
  console.info(`creating Supabase client: https://supabase.com/dashboard/project/${supabaseId}`)

  if (!browser)
    return createClient(PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

  if (supabase)
    return supabase

  return createClient(PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: true } })
}

const NULL_RESPONSE = {
  data: {
    user: null,
    session: null,
  },
  error: { message: 'no session' },
} as AuthResponse

export async function getSession({ supabase, access_token, refresh_token }: { supabase: SupabaseClient, access_token: string, refresh_token: string }) {
  if (!access_token || !refresh_token)
    return NULL_RESPONSE

  const authResponse = await supabase.auth.setSession({ access_token, refresh_token })
  return authResponse
}
