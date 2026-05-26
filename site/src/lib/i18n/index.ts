/* eslint-disable require-atomic-updates */
import type { LocaleCode } from './locales'
import type { TranslateFunction, TranslationKeys } from './types'
import { interpolate } from './interpolate'
import en_base from './locales/en.json' with { type: 'json' }
import en_gloss from './locales/gl/en.json' with { type: 'json' }
import en_parts_of_speech from './locales/ps/en.json' with { type: 'json' }
import en_parts_of_speech_abbrev from './locales/psAbbrev/en.json' with { type: 'json' }
import en_semantic_domains from './locales/sd/en.json' with { type: 'json' }

export const en = {
  ...en_base,
  ...en_gloss,
  ...en_parts_of_speech,
  ...en_parts_of_speech_abbrev,
  ...en_semantic_domains,
}

// English is always loaded because it is the fallback
const loaded_translations: Record<string, typeof en> = { en }

export interface TranslateOptions {
  values?: Record<string, string>
  dynamic_key?: string
  fallback?: string
}

export async function get_translator(locale: LocaleCode) {
  if (!loaded_translations[locale]) {
    loaded_translations[locale] = {
      ...await import(`./locales/${locale}.json`),
      ...await import(`./locales/gl/${locale}.json`), // glossing languages
      ...await import(`./locales/ps/${locale}.json`), // parts of speech
      ...await import(`./locales/psAbbrev/${locale}.json`),
      ...await import(`./locales/sd/${locale}.json`), // semantic domains
    }
  }

  return (key_or_options: TranslationKeys | TranslateOptions, options?: TranslateOptions): string => {
    let key: string

    if (typeof key_or_options === 'string') {
      key = key_or_options
    } else {
      options = key_or_options
      key = options.dynamic_key
    }

    if (!key.includes('.'))
      throw new Error('Incorrect i18n key. Must be nested 1 level (contain 1 period).')

    const [section, item] = split_by_first_period(key)

    const locale_result = loaded_translations[locale][section]?.[item]
    if (locale_result)
      return interpolate(locale_result, options?.values)
    console.warn(`Missing ${locale} translation for ${key}`)

    const english_result = loaded_translations.en[section][item]
    if (english_result)
      return interpolate(english_result, options?.values)

    return options?.fallback || key
  }
}

function split_by_first_period(key: string): [string, string] {
  const [section, ...rest] = key.split('.') as [string, string]
  const item = rest.join('.')
  return [section, item]
}

if (import.meta.vitest) {
  describe(split_by_first_period, () => {
    test('splits with one period', () => {
      const [section, item] = split_by_first_period('hello.world')
      expect([section, item]).toEqual(['hello', 'world'])
    })

    test('only splits on first period when there are two', () => {
      const [section, item] = split_by_first_period('ps.pr.n')
      expect([section, item]).toEqual(['ps', 'pr.n'])
    })
  })
}

export const english_translate = (({ dynamic_key: key, fallback }: { dynamic_key: string, fallback?: string }) => {
  const [section, item] = split_by_first_period(key)
  return en[section][item] || fallback
}) as TranslateFunction
