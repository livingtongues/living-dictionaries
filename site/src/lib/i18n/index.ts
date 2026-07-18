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

/**
 * Sections whose keys mix a canonical UI catalog with FREE-FORM USER DATA:
 * parts of speech + semantic domains accept arbitrary user-entered values by
 * design (custom semantic domains like `Verbs; Motion`, Mayan dicts storing full
 * Spanish phrases as POS, Italian `v-è` verb labels). The EN catalog defines the
 * canonical translatable set — a key absent from it is data, not a UI string, so
 * it renders raw with NO lookup cascade and NO missing-key report (decision
 * 2026-07-17: these values will never have translations and must not be promoted
 * into the catalog or logged as translation gaps).
 */
const USER_DATA_SECTIONS = new Set(['ps', 'psAbbrev', 'sd'])

/**
 * A locale can be published (added to `Locales`) a deploy BEFORE its committed
 * files are baked (a fresh locale like `de` is filled in the DB, then the next
 * deploy's export/bake writes the files). Until then the file `import()` rejects
 * with "Unknown variable dynamic import" — swallow it and fall back to `{}` so
 * every key resolves to the English base instead of crashing the whole app.
 */
async function load_locale_file(path_promise: Promise<unknown>): Promise<Record<string, unknown>> {
  try {
    return await path_promise as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function getTranslator(locale: LocaleCode) {
  if (!loadedTranslations[locale]) {
    loadedTranslations[locale] = {
      ...await load_locale_file(import(`./locales/${locale}.json`)),
      ...await load_locale_file(import(`./locales/gl/${locale}.json`)), // glossing languages
      ...await load_locale_file(import(`./locales/ps/${locale}.json`)), // parts of speech
      ...await load_locale_file(import(`./locales/psAbbrev/${locale}.json`)),
      ...await load_locale_file(import(`./locales/sd/${locale}.json`)), // semantic domains
    } as typeof en
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

    // Free-form user-entered value (custom semantic domain / unknown POS) —
    // render it raw, skip the lookup + missing-key report entirely.
    if (USER_DATA_SECTIONS.has(section) && loadedTranslations.en[section]?.[item] === undefined)
      return options?.fallback || item

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

    test('renders free-form POS / semantic-domain values raw with NO missing-key report', async () => {
      const reported: string[] = []
      set_missing_translation_handler(info => reported.push(info.key))
      const t = await getTranslator('en')

      // User-entered values (custom domains, unknown POS) are data, not UI strings.
      expect(t({ dynamicKey: 'ps.v-è', fallback: 'v-è' })).toBe('v-è')
      expect(t({ dynamicKey: 'psAbbrev.v-isce', fallback: 'v-isce' })).toBe('v-isce')
      expect(t({ dynamicKey: 'sd.Verbs; Motion; Pronouns', fallback: 'Verbs; Motion; Pronouns' })).toBe('Verbs; Motion; Pronouns')
      // No fallback passed → still the raw value, never the prefixed key.
      expect(t({ dynamicKey: 'sd.Custom Domain' })).toBe('Custom Domain')

      expect(reported).toEqual([])
      set_missing_translation_handler(null)
    })

    test('canonical POS / semantic-domain keys still translate', async () => {
      const t = await getTranslator('en')
      expect(t({ dynamicKey: 'ps.n' })).toBe('noun')
      expect(t({ dynamicKey: 'sd.1' })).toBe('Universe and the natural world')
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
