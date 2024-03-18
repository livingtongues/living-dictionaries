import type { IUser } from '@living-dictionaries/types';
import type { LayoutServerLoad } from './$types';
import { findSupportedLocaleFromAcceptedLanguages } from '$lib/i18n/locales';

export const load: LayoutServerLoad = ({ cookies, request }) => {
  const chosenLocale = cookies.get('locale')
  const acceptedLanguage = findSupportedLocaleFromAcceptedLanguages(request.headers.get('accept-language'))

  let user_from_cookies: IUser = null;
  try {
    user_from_cookies = JSON.parse(cookies.get('user') || null) as IUser;
  } catch (err) {
    console.error(err);
  }

  return {
    serverLocale: chosenLocale || acceptedLanguage,
    user_from_cookies,
  };
};
