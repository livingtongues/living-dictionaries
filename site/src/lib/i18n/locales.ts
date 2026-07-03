export enum Locales {
  en = 'English',
  es = 'Español',
  fr = 'Français',
  zh = '中文',
  sw = 'Kiswahili',
  ru = 'русский',
  he = 'עברית',
  pt = 'Portuguese',
  id = 'Bahasa Indonesia',
  ms = 'Malay',
  bn = 'বাংলা', // Bengali,
  as = 'Assamese / অসমীয়া',
  hi = 'हिन्दी',
  vi = 'Vietnamese',
}

export type LocaleCode = keyof typeof Locales

export enum UnpublishedLocales {
  ha = 'Harshen Hausa / هَرْشَن هَوْسَ',
  ar = 'العَرَبِيَّة‎',
  am = 'አማርኛ',
  or = 'ଓଡ଼ିଆ',
  // it = 'Italiano', // change to how they spell it
  // as = 'অসমীয়া',
  // yo = 'Yoruba'
  // zu = 'Zulu'
  // sn = 'Shona'
  // tl = 'Tagalog' // (or could be Filipino 'fil')
}
// add more codes from https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry

export type UnpublishedLocaleCode = keyof typeof UnpublishedLocales

/** Every locale a translator can work on: published + unpublished, minus English (the code-owned source). */
export type TranslatableLocale = Exclude<LocaleCode | UnpublishedLocaleCode, 'en'>

export const TRANSLATABLE_LOCALES = [
  ...Object.keys(Locales).filter(locale => locale !== 'en'),
  ...Object.keys(UnpublishedLocales),
] as TranslatableLocale[]

export function get_locale_display_name(locale: string): string {
  return (Locales as Record<string, string>)[locale] || (UnpublishedLocales as Record<string, string>)[locale] || locale
}

export function findSupportedLocaleFromAcceptedLanguages(acceptedLanguageHeader: string | null) {
  const locales = acceptedLanguageHeader
    ?.split(',')
    ?.map(lang => lang.split(';')[0].trim()) ?? []
  for (const locale of locales) {
    const supportedLocale = getSupportedLocale(locale)
    if (supportedLocale)
      return supportedLocale
  }
}

export function getSupportedLocale(userLocale: string | undefined) {
  return Object.keys(Locales).find((supportedLocale) => {
    return userLocale?.includes(supportedLocale)
  }) as LocaleCode | undefined
}
