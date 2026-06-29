/* eslint-disable require-atomic-updates */
import enBase from './locales/en.json' with { type: 'json' }
import enGloss from './locales/gl/en.json' with { type: 'json' }
import enPartsOfSpeech from './locales/ps/en.json' with { type: 'json' }
import enPartsOfSpeechAbbrev from './locales/psAbbrev/en.json' with { type: 'json' }
import enSemanticDomains from './locales/sd/en.json' with { type: 'json' }

import type { LocaleCode } from './locales'
import type { TranslateFunction, TranslationKeys } from './types'
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

export interface MissingTranslation {
  key: string
  locale: string
  fallback?: string
}

/**
 * Injected reporter for a genuinely-missing key (no English base). Wired up
 * client-side in `+layout.svelte` onMount so it ships to `client_logs`; left null
 * on the server and in tests. Dependency-injected (not a direct import of the
 * logger) to keep this leaf module free of the telemetry stack and to guarantee
 * we only ship from the browser.
 */
let on_missing_translation: ((info: MissingTranslation) => void) | null = null
export function set_missing_translation_handler(handler: ((info: MissingTranslation) => void) | null): void {
  on_missing_translation = handler
}

/**
 * Dedupe so a re-rendering list (which calls `t()` for the same key hundreds of
 * times) reports each unique missing key only ONCE per page session — both to the
 * dev console and to telemetry. Keyed by `locale:key`.
 */
const reported_missing = new Set<string>()
function report_missing_translation({ key, locale, fallback }: MissingTranslation): void {
  const dedupe_key = `${locale}:${key}`
  if (reported_missing.has(dedupe_key))
    return
  reported_missing.add(dedupe_key)
  console.warn(`i18n: missing translation key "${key}"${fallback ? ` — using fallback "${fallback}"` : ''}`)
  on_missing_translation?.({ key, locale, fallback })
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

    // A missing translation in a non-English locale is normal — human translators
    // fill those in over time and we silently fall back to English. Only warn when
    // the English base ALSO lacks the key, which is a real bug (a typo in code, a
    // removed string, or a bad dynamicKey) worth turning into an action item.
    const englishResult = loadedTranslations.en[section]?.[item]
    if (englishResult)
      return interpolate(englishResult, options?.values)

    report_missing_translation({ key, locale, fallback: options?.fallback })
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
      expect([section, item]).toEqual(['hello', 'world'])
    })

    test('only splits on first period when there are two', () => {
      const [section, item] = splitByFirstPeriod('ps.pr.n')
      expect([section, item]).toEqual(['ps', 'pr.n'])
    })
  })

  describe(getTranslator, () => {
    test('reports a fully-missing key (no English base) once per unique key', async () => {
      const reported: string[] = []
      set_missing_translation_handler(info => reported.push(info.key))
      const t = await getTranslator('en')

      // `gl.zz-not-a-real-language` exists in neither the active locale nor English.
      expect(t({ dynamicKey: 'gl.zz-not-a-real-language', fallback: 'fb' })).toBe('fb')
      t({ dynamicKey: 'gl.zz-not-a-real-language' }) // repeat → deduped, no second report

      expect(reported).toEqual(['gl.zz-not-a-real-language'])
      set_missing_translation_handler(null)
    })

    test('does NOT report when an English fallback exists', async () => {
      const reported: string[] = []
      set_missing_translation_handler(info => reported.push(info.key))
      const t = await getTranslator('en')

      expect(t('misc.add')).toBeTruthy() // real key present in English base
      expect(reported).toEqual([])
      set_missing_translation_handler(null)
    })
  })
}

export const english_translate = (({ dynamicKey: key, fallback }: { dynamicKey: string, fallback?: string }) => {
  const [section, item] = splitByFirstPeriod(key)
  return en[section][item] || fallback
}) as TranslateFunction
