import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@living-dictionaries/types'
import { create_stub_supabase_client } from './stub-client'

// https://supabase.com/docs/reference/javascript/typescript-support
export type Supabase = SupabaseClient<Database>
// vps-migration M1: Supabase removed — source mode from Vite instead of PUBLIC_MODE.
export const mode = import.meta.env.MODE as 'development' | 'production'

const browser = typeof window !== 'undefined'
let supabase: Supabase | undefined

// return a unique instance on server, but a shared instance on client
// runs in hooks for easy use in api and server data fetching
// runs in +layout.ts for isomorphic use in pages
// the result is that on the server, two clients are created with the same auth - it's not a race condition issue but it's not ideal, however we can't just do it once because we can't pass it to +layout.ts from +layout.server.ts
// vps-migration M1: returns an in-memory stub client (no network, no Supabase env).
export function getSupabase() {
  if (browser && supabase)
    return supabase

  const _supabase = create_stub_supabase_client()

  if (browser)
    supabase = _supabase

  return _supabase
}
