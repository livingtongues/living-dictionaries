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

export function find_supported_locale_from_accepted_languages(accepted_language_header: string | null) {
  const locales = accepted_language_header
    ?.split(',')
    ?.map(lang => lang.split(';')[0].trim()) ?? []
  for (const locale of locales) {
    const supported_locale = get_supported_locale(locale)
    if (supported_locale)
      return supported_locale
  }
}

export function get_supported_locale(user_locale: string | undefined) {
  return Object.keys(Locales).find((supported_locale) => {
    return user_locale?.includes(supported_locale)
  }) as LocaleCode | undefined
}
