import type { AuthUserData } from '$lib/auth/types'
import type { LayoutServerLoad } from './$types'
import { verify_jwt } from '$lib/auth/jwt'
import { get_shared_db } from '$lib/db/server/shared-db'
import { get_user } from '$lib/server/get-user'
import { findSupportedLocaleFromAcceptedLanguages } from '$lib/i18n/locales'

/**
 * M4-auth: resolve the SSR user from the httpOnly `session` cookie (JWT) so the
 * first-paint shell renders auth-aware. Replaces the legacy Supabase
 * access/refresh-token cookies. On verify failure (expired/mismatched secret),
 * we behave as logged-out — a stale cookie clears itself on the client.
 */
export const load: LayoutServerLoad = async ({ cookies, request }) => {
  const chosenLocale = cookies.get('locale')
  const acceptedLanguage = findSupportedLocaleFromAcceptedLanguages(request.headers.get('accept-language'))

  const user_latitude = request.headers.get('x-vercel-ip-latitude')
  const user_longitude = request.headers.get('x-vercel-ip-longitude')

  let ssr_user: AuthUserData | null = null
  const token = cookies.get('session')
  if (token) {
    try {
      const { sub } = await verify_jwt(token)
      ssr_user = get_user({ db: get_shared_db(), user_id: sub, cookies }) ?? null
    } catch {
      ssr_user = null
    }
  }

  return {
    serverLocale: chosenLocale || acceptedLanguage,
    ssr_user,
    user_latitude,
    user_longitude,
  }
}
