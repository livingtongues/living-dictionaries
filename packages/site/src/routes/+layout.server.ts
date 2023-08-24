import { loadLocaleOnServer } from '$lib/i18n';
import type { IUser } from '@living-dictionaries/types';

import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = async ({ cookies, request }) => {
  let acceptedLanguage = 'en';
  if (request.headers['accept-language'])
    acceptedLanguage = request.headers['accept-language'].split(',')[0].trim();


  const chosenLocale = cookies.get('locale') || null;

  // perhaps could still run in hooks.server.ts
  await loadLocaleOnServer(chosenLocale, acceptedLanguage);

  let user: IUser = null;
  try {
    user = JSON.parse(cookies.get('user') || null) as IUser;
  } catch (err) {
    console.error(err);
  }

  return {
    user,
  };
};
