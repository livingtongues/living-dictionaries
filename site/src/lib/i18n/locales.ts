export enum Locales {
  'en' = 'English',
  'es' = 'Español',
  'fr' = 'Français',
  'de' = 'Deutsch',
  'zh-CN' = '简体中文',
  'zh-TW' = '繁體中文',
  'sw' = 'Kiswahili',
  'ru' = 'русский',
  'he' = 'עברית',
  'ar' = 'العَرَبِيَّة‎',
  'pt' = 'Portuguese',
  'id' = 'Bahasa Indonesia',
  'ms' = 'Malay',
  'bn' = 'বাংলা', // Bengali,
  'as' = 'Assamese / অসমীয়া',
  'hi' = 'हिन्दी',
  'vi' = 'Vietnamese',
}

export type LocaleCode = keyof typeof Locales

export enum UnpublishedLocales {
  ha = 'Harshen Hausa / هَرْشَن هَوْسَ',
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

/**
 * Map an arbitrary locale string (cookie value, `?lang=`, or an `accept-language`
 * token) to a supported published `LocaleCode`. Exact match wins; otherwise a
 * small alias table resolves regional/script variants — notably the two Chinese
 * scripts, which a naive substring match cannot disambiguate (`'zh-Hant'`
 * contains `'zh'`). Ported from tutor's parser, with one LD-specific choice:
 * a bare `zh` resolves to Simplified (`zh-CN`) to preserve the experience of
 * users whose cookie was set before the `zh` → `zh-CN` rename.
 */
const LOCALE_ALIASES: Record<string, LocaleCode> = {
  'en-US': 'en',
  'en-GB': 'en',
  'zh': 'zh-CN',
  'zh-Hans': 'zh-CN',
  'zh-SG': 'zh-CN',
  'zh-Hant': 'zh-TW',
  'zh-HK': 'zh-TW',
  'zh-MO': 'zh-TW',
}

export function getSupportedLocale(userLocale: string | undefined): LocaleCode | undefined {
  if (!userLocale)
    return
  if (Object.keys(Locales).includes(userLocale))
    return userLocale as LocaleCode
  return LOCALE_ALIASES[userLocale]
}

if (import.meta.vitest) {
  describe(getSupportedLocale, () => {
    test('exact matches return the code', () => {
      expect(getSupportedLocale('en')).toBe('en')
      expect(getSupportedLocale('zh-CN')).toBe('zh-CN')
      expect(getSupportedLocale('zh-TW')).toBe('zh-TW')
    })
    test('disambiguates the two Chinese scripts via aliases', () => {
      expect(getSupportedLocale('zh')).toBe('zh-CN') // legacy cookie → Simplified
      expect(getSupportedLocale('zh-Hans')).toBe('zh-CN')
      expect(getSupportedLocale('zh-Hant')).toBe('zh-TW')
      expect(getSupportedLocale('zh-HK')).toBe('zh-TW')
    })
    test('regional English aliases resolve to en', () => {
      expect(getSupportedLocale('en-GB')).toBe('en')
    })
    test('unsupported or empty input returns undefined', () => {
      expect(getSupportedLocale('xx')).toBe(undefined)
      expect(getSupportedLocale(undefined)).toBe(undefined)
      expect(getSupportedLocale('')).toBe(undefined)
    })
  })

  describe(findSupportedLocaleFromAcceptedLanguages, () => {
    test('picks the first supported token, mapping variants', () => {
      expect(findSupportedLocaleFromAcceptedLanguages('zh-Hant;q=0.9,en;q=0.8')).toBe('zh-TW')
      expect(findSupportedLocaleFromAcceptedLanguages('fr-CA,fr;q=0.9')).toBe('fr')
    })
    test('null header → undefined', () => {
      expect(findSupportedLocaleFromAcceptedLanguages(null)).toBe(undefined)
    })
  })
}
