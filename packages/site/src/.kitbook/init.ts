import { init, register, getLocaleFromNavigator } from 'svelte-i18n';

export default async function () {
  await initI18n();
}

async function initI18n(): Promise<void> {
  registerMessages('en');
  await init({
    fallbackLocale: 'en',
    initialLocale: getLocaleFromNavigator(),
    // handleMissingMessage: ({ locale, id, defaultValue }) => {
    //   return defaultValue;
    // }
  });
}

function registerMessages(bcp: string) {
  register(bcp, () => import(`../locales/${bcp}.json`));
  register(bcp, () => import(`../locales/gl/${bcp}.json`)); // glossing languages
  register(bcp, () => import(`../locales/ps/${bcp}.json`)); // parts of speech
  register(bcp, () => import(`../locales/psAbbrev/${bcp}.json`));
  register(bcp, () => import(`../locales/sd/${bcp}.json`)); // semantic domains
}
