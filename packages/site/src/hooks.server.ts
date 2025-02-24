import { getSession, getSupabase } from '$lib/supabase'
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from '$lib/constants'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // only useful for things that are guaranteed to run server-side but not for passing to the client
  event.locals.getSession = async () => {
    const supabase = getSupabase()
    const access_token = event.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    const refresh_token = event.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    const session = await getSession({ supabase, access_token, refresh_token })
    return { ...session, supabase }
  }

  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%unocss-svelte-scoped.global%', 'unocss_svelte_scoped_global_styles'),
  })
  return response
}
