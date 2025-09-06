import type { LayoutServerLoad } from './$types'
import { findSupportedLocaleFromAcceptedLanguages } from '$lib/i18n/locales'
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from '$lib/constants'

export const load: LayoutServerLoad = ({ cookies, request }) => {
  const chosenLocale = cookies.get('locale')
  const acceptedLanguage = findSupportedLocaleFromAcceptedLanguages(request.headers.get('accept-language'))

  const access_token = cookies.get(ACCESS_TOKEN_COOKIE_NAME)
  const refresh_token = cookies.get(REFRESH_TOKEN_COOKIE_NAME)

  const user_latitude = request.headers.get('x-vercel-ip-latitude')
  const user_longitude = request.headers.get('x-vercel-ip-longitude')

  return {
    serverLocale: chosenLocale || acceptedLanguage,
    access_token,
    refresh_token,
    user_latitude,
    user_longitude,
  }
}
