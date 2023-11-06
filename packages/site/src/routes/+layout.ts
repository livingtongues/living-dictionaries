import type { LayoutLoad } from './$types';
import { getTranslator } from '$lib/i18n'
import { getSupportedLocale } from '$lib/i18n/locales'

export const load: LayoutLoad = async ({  url: { searchParams }, data: { serverLocale, user } }) => {
  const urlLocale = searchParams.get('lang')
  const locale = getSupportedLocale(urlLocale || serverLocale) || 'en'
  const t = await getTranslator(locale)
  return { locale, t, user }
};
