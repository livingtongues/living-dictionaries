import type { AuthUserData } from '$lib/auth/types'
import type { LayoutServerLoad } from './$types'
import { verify_jwt } from '$lib/auth/jwt'
import { get_shared_db } from '$lib/db/server/shared-db'
import { bump_last_visit } from '$lib/server/bump-last-visit'
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
      const db = get_shared_db()
      ssr_user = get_user({ db, user_id: sub, cookies }) ?? null
      // Record activity for EVERY authenticated visit (throttled once/UTC-day),
      // so "active last 30 days" reflects all users, not just syncing admins.
      if (ssr_user)
        bump_last_visit({ db, user_id: sub })
    } catch {
      ssr_user = null
    }
  }

  return {
    serverLocale: chosenLocale || acceptedLanguage,
    ssr_user,
    user_latitude,
    user_longitude,
    // Locales with ≥1 assigned translator — a published locale absent from this
    // list shows the "needs a reviewer" recruiting prompt in the language switcher.
    locales_with_translators: get_locales_with_translators(),
  }
}

/** DISTINCT `translator_languages.locale`; empty on any DB error (fail open → no recruiting prompt). */
function get_locales_with_translators(): string[] {
  try {
    const rows = get_shared_db()
      .prepare('SELECT DISTINCT locale FROM translator_languages')
      .all() as { locale: string }[]
    return rows.map(row => row.locale)
  } catch {
    return []
  }
}
