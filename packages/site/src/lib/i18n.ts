import { register, init, getLocaleFromNavigator, waitLocale, locale as $locale } from 'svelte-i18n';
import { ReadyLocales, UnpublishedLocales } from '../locales/languages.interface';
import { getCookie } from '$lib/helpers/cookies';

const INIT_OPTIONS = {
  fallbackLocale: 'en',
  initialLocale: null,
  loadingDelay: 200,
  warnOnMissingMessages: true,
};

Object.keys(ReadyLocales).forEach((bcp) => {
  registerMessages(bcp);
});
Object.keys(UnpublishedLocales).forEach((bcp) => {
  registerMessages(bcp);
});

function registerMessages(bcp: string) {
  register(bcp, () => import(`../locales/${bcp}.json`));
  register(bcp, () => import(`../locales/gl/${bcp}.json`)); // glossing languages
  register(bcp, () => import(`../locales/ps/${bcp}.json`)); // parts of speech
  register(bcp, () => import(`../locales/psAbbrev/${bcp}.json`));
  register(bcp, () => import(`../locales/sd/${bcp}.json`)); // semantic domains
}

function isReadyLocale(userLocale: string) {
  return !!Object.keys(ReadyLocales).filter((locale) => {
    return userLocale.includes(locale);
  }).length;
}

let i18nInited = false;

export async function loadLocaleOnClient(locale = 'en') {
  if (i18nInited) return;
  INIT_OPTIONS.initialLocale = getLocalePreference() || locale;
  init(INIT_OPTIONS);
  i18nInited = true;
  return await waitLocale();
}

function getLocalePreference(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const urlLocale = urlParams.get('lang');
  if (urlLocale)
    return urlLocale;

  const chosenLocale = getCookie('locale') || null;
  if (chosenLocale)
    return chosenLocale;

  const acceptedLanguage = getLocaleFromNavigator() || null;
  if (isReadyLocale(acceptedLanguage))
    return acceptedLanguage;
}

let currentLocale = null;
export async function loadLocaleOnServer(chosenLocale: string, acceptedLanguage: string) {
  let locale = chosenLocale;
  if (!locale) {
    if (isReadyLocale(acceptedLanguage))
      locale = acceptedLanguage;
    else
      locale = 'en';

  }
  if (i18nInited) {
    if (locale !== currentLocale)
      $locale.set(locale);


  } else {
    INIT_OPTIONS.initialLocale = locale;
    init(INIT_OPTIONS);
    i18nInited = true;
    return await waitLocale();
  }
}

$locale.subscribe((value) => {
  if (value == null) return;
  currentLocale = value;
  // if running in the client, save the language preference in a cookie
  // if (browser) {
  // Moved to SelectLanguage.svelte so that this only happens on intentional changes to keep users of languages not ready from getting their language permanently set to English. We would like to serve them their language when that becomes available.
  // setCookie('locale', value, { 'max-age': 31536000 });
  // }
});
