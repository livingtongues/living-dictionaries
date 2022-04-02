import { getCookie } from '$lib/helpers/cookies';
import type { Handle, GetSession } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  let user = null;
  try {
    user = JSON.parse(getCookie('user', event.request.headers.get('cookie')) || null);
  } catch (err) {
    console.log(err);
  }
  event.locals.user = user;
  event.locals.chosenLocale = getCookie('locale', event.request.headers.get('cookie')) || null;

  const response = await resolve(event);
  return response;
};

export const getSession: GetSession = (event) => {
  let acceptedLanguage = 'en';
  if (event.request.headers['accept-language']) {
    acceptedLanguage = event.request.headers['accept-language'].split(',')[0].trim();
  }
  return {
    user: event.locals.user,
    acceptedLanguage,
    chosenLocale: event.locals.chosenLocale,
  };
};
