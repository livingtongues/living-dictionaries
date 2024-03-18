/* eslint-disable require-atomic-updates */
import enBase from './locales/en.json' assert { type: 'json' };
import enGloss from './locales/gl/en.json' assert { type: 'json' };
import enPartsOfSpeech from './locales/ps/en.json' assert { type: 'json' };
import enPartsOfSpeechAbbrev from './locales/psAbbrev/en.json' assert { type: 'json' };
import enSemanticDomains from './locales/sd/en.json' assert { type: 'json' };

import type { LocaleCode } from './locales'
import type { TranslationKeys } from './types'
import { interpolate } from './interpolate'
export const en = {
  ...enBase,
  ...enGloss,
  ...enPartsOfSpeech,
  ...enPartsOfSpeechAbbrev,
  ...enSemanticDomains,
}

// English is always loaded because it is the fallback
const loadedTranslations: Record<string, typeof en> = { en }

// interface GetTranslatorOptions {
//   errorOnMissingBase: boolean
// }

export interface TranslateOptions {
  values?: Record<string, string>
  dynamicKey?: string
  fallback?: string
}

export async function getTranslator(locale: LocaleCode) {
  if (!loadedTranslations[locale]) {
    loadedTranslations[locale] = {
      ...await import(`./locales/${locale}.json`),
      ...await import(`./locales/gl/${locale}.json`), // glossing languages
      ...await import(`./locales/ps/${locale}.json`), // parts of speech
      ...await import(`./locales/psAbbrev/${locale}.json`),
      ...await import(`./locales/sd/${locale}.json`), // semantic domains
    }
  }

  return (keyOrOptions: TranslationKeys | TranslateOptions, options?: TranslateOptions): string => {
    let key: string

    if (typeof keyOrOptions === 'string') {
      key = keyOrOptions
    } else {
      options = keyOrOptions
      key = options.dynamicKey
    }

    if (!key.includes('.'))
      throw new Error('Incorrect i18n key. Must be nested 1 level (contain 1 period).')

    const [section, item] = splitByFirstPeriod(key)

    const localeResult = loadedTranslations[locale][section]?.[item]
    if (localeResult)
      return interpolate(localeResult, options?.values)
    console.warn(`Missing ${locale} translation for ${key}`)

    const englishResult = loadedTranslations.en[section][item]
    if (englishResult)
      return interpolate(englishResult, options?.values)
    // const error = `Missing English for: ${key}`

    // console.error(error)
    return options?.fallback || key
  }
}

function splitByFirstPeriod(key: string): [string, string] {
  const [section, ...rest] = key.split('.') as [string, string]
  const item = rest.join('.')
  return [section, item]
}

if (import.meta.vitest) {
  describe(splitByFirstPeriod, () => {
    test('splits with one period', () => {
      const [section, item] = splitByFirstPeriod('hello.world')
      expect([section, item]).toEqual(['hello', 'world']);
    });

    test('only splits on first period when there are two', () => {
      const [section, item] = splitByFirstPeriod('ps.pr.n')
      expect([section, item]).toEqual(['ps', 'pr.n']);
    });
  });
}
