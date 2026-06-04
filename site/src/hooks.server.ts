import { getSupabase } from '$lib/supabase'
import { get_legacy_session } from '$lib/supabase/get-legacy-session.server'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // M4-auth: rebuild the legacy Supabase-shaped session from the real
  // session-cookie JWT for the not-yet-migrated write/media/email endpoints.
  event.locals.getSession = async () => {
    const supabase = getSupabase()
    const session = await get_legacy_session({ supabase, cookies: event.cookies })
    return { ...session, supabase }
  }

  const response = await resolve(event)
  return response
}
