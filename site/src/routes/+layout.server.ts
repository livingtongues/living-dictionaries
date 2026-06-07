import type { AuthUserData } from '$lib/auth/types'
import type { LayoutServerLoad } from './$types'
import { verify_jwt } from '$lib/auth/jwt'
import { get_shared_db } from '$lib/db/server/shared-db'
import { get_user } from '$lib/server/get-user'
import { findSupportedLocaleFromAcceptedLanguages } from '$lib/i18n/locales'

/**
 * Resolve the signed-in user from the httpOnly `session` JWT cookie so the
 * auth-aware shell renders on first paint. A
 * verify failure (expired / wrong-secret token) self-clears the cookie and we
 * behave as logged-out.
 */
export const load: LayoutServerLoad = async ({ cookies, request }) => {
  const chosenLocale = cookies.get('locale')
  const acceptedLanguage = findSupportedLocaleFromAcceptedLanguages(request.headers.get('accept-language'))

  const user_latitude = request.headers.get('cf-iplatitude')
  const user_longitude = request.headers.get('cf-iplongitude')

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
