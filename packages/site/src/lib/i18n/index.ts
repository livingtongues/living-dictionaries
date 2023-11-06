/* eslint-disable require-atomic-updates */
import enBase from './locales/en'
import enGloss from './locales/gl/en'
import enPartsOfSpeech from './locales/ps/en'
import enPartsOfSpeechAbbrev from './locales/psAbbrev/en'
import enSemanticDomains from './locales/sd/en'

import type { LocaleCode } from './locales'
import type { TranslationKeys } from './types'
import { interpolate } from './interpolate'
import { dev } from '$app/environment'

export const en = {
  ...enBase,
  ...enGloss,
  ...enPartsOfSpeech,
  ...enPartsOfSpeechAbbrev,
  ...enSemanticDomains,
}

// English is always loaded because it is the fallback
const loadedTranslations: Record<string, typeof en> = { en }

export async function getTranslator(locale: LocaleCode) {
  if (!loadedTranslations[locale]) {
    loadedTranslations[locale] = {
      ...(await import(`./locales/${locale}.js`)).default,
      ...(await import(`./locales/gl/${locale}.js`)).default, // glossing languages
      ...(await import(`./locales/ps/${locale}.js`)).default, // parts of speech
      ...(await import(`./locales/psAbbrev/${locale}.js`)).default,
      ...(await import(`./locales/sd/${locale}.js`)).default, // semantic domains
    }
  }

  return (key: TranslationKeys, options?: { values?: Record<string, string>, fallback?: string }): string => {
    if (!key.includes('.'))
      throw new Error('Incorrect i18n key. Must be nested 1 level (contain 1 period).')

    const [section, item] = key.split('.') as [string, string]

    const localeResult = loadedTranslations[locale][section]?.[item]
    if (localeResult)
      return interpolate(localeResult, options?.values)
    console.warn(`Missing ${locale} translation for ${key}`)

    const englishResult = loadedTranslations.en[section][item]
    if (englishResult)
      return interpolate(englishResult, options?.values)
    const error = `Missing English for: ${key}`

    if (dev)
      throw new Error(error)

    console.error(error)
    return options?.fallback || key
  }
}
