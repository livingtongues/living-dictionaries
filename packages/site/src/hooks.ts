import { getCookie } from '$lib/helpers/cookies';
import type { Handle, GetSession } from '@sveltejs/kit';

export const handle: Handle = async ({ request, resolve }) => {
  let user = null;
  try {
    user = JSON.parse(getCookie('user', request.headers.cookie) || null);
  } catch (err) {
    console.log(err);
  }
  request.locals.user = user;
  request.locals.chosenLocale = getCookie('locale', request.headers.cookie) || null;

  const response = await resolve(request);
  return response;
};

export const getSession: GetSession = (request) => {
  let acceptedLanguage = 'en';
  if (request.headers['accept-language']) {
    acceptedLanguage = request.headers['accept-language'].split(',')[0].trim();
  }
  return {
    user: request.locals.user,
    acceptedLanguage,
    chosenLocale: request.locals.chosenLocale,
  };
};
