import { layoutLoad } from 'kitbook';
import { pages } from './moduleImports';
export const load = layoutLoad({ pages, initFunction })

import { init, getLocaleFromNavigator } from 'svelte-i18n';
async function initFunction(): Promise<void> {
  // register('en', () => import('./en.json'));
  await init({
    fallbackLocale: 'en',
    initialLocale: getLocaleFromNavigator(),
    // handleMissingMessage: ({ locale, id, defaultValue }) => {
    //   return defaultValue;
    // }
  });
}
