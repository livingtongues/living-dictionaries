import type { EntryData } from '$lib/types'
import type { DeepPartial } from '$lib/utils/deep-partial'
import type { TranslateFunction } from '$lib/i18n/types'
import { order_entry_and_dictionary_gloss_languages } from '$lib/gloss/order-glosses'
import { remove_italic_tags } from '$lib/utils/remove-italic-tags'

const MAX_GLOSS_LENGTH = 45

/** 50/50 SEO title test (started 2026-07-31, readout ~2026-08-21 — see house
 * .issues/google-search-console-cli.md): the `gloss_title` arm surfaces the first
 * gloss in the `<title>` so the SERP answers the dominant `<word> in English`
 * query intent; `control` keeps the headword-only title. Deterministic by entry
 * id so the arm is stable across builds AND re-derivable from GSC page URLs when
 * scoring. djb2 — keep in sync with any scoring script. */
export function entry_title_test_arm(entry_id: string): 'gloss_title' | 'control' {
  let hash = 5381
  for (let index = 0; index < entry_id.length; index++)
    hash = ((hash * 33) ^ entry_id.charCodeAt(index)) >>> 0
  return hash % 2 === 0 ? 'gloss_title' : 'control'
}

/** Returns `भांजी (Bhanji) means “Niece” in English` (SeoMetaTags appends
 * `| {Dictionary} Living Dictionary`), or null to fall back to the
 * headword-only title: control arm, no gloss, or an over-long/degenerate gloss. */
export function seo_entry_title({ entry, headword, gloss_languages, t }: {
  entry: DeepPartial<EntryData>
  headword: string
  gloss_languages: string[]
  t: TranslateFunction
}): string | null {
  if (!headword || !entry.id) return null
  if (entry_title_test_arm(entry.id) === 'control') return null

  const glosses = entry.senses?.[0]?.glosses
  const ordered_languages = order_entry_and_dictionary_gloss_languages(glosses, gloss_languages)
  const language_with_gloss = ordered_languages.find(bcp => glosses?.[bcp])
  if (!language_with_gloss) return null

  const gloss = clean_gloss(glosses[language_with_gloss])
  if (!gloss || gloss.length > MAX_GLOSS_LENGTH) return null

  const language_name = t({ dynamicKey: `gl.${language_with_gloss}`, fallback: language_with_gloss })
  return `${headword} means “${gloss}” in ${language_name}`
}

/** First gloss only (split on ; or ,), trailing parenthetical dropped —
 * `Niece (Sister's daughter)` → `Niece`. */
function clean_gloss(raw_gloss: string): string {
  const without_markup = remove_italic_tags(raw_gloss)
  const [first_segment] = without_markup.split(/[;,]/)
  return first_segment.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim()
}

if (import.meta.vitest) {
  const t: TranslateFunction = (key_or_options) => {
    if (typeof key_or_options === 'string') return key_or_options
    const names: Record<string, string> = { 'gl.en': 'English', 'gl.hi': 'Hindi' }
    return names[key_or_options.dynamicKey] || key_or_options.fallback || key_or_options.dynamicKey
  }

  describe(entry_title_test_arm, () => {
    test('is deterministic and splits roughly evenly', () => {
      expect(entry_title_test_arm('cPKNSGDd813dMk11C84r')).toBe(entry_title_test_arm('cPKNSGDd813dMk11C84r'))
      const arms = Array.from({ length: 1000 }, (_, index) => entry_title_test_arm(`entry-${index}`))
      const gloss_arm_count = arms.filter(arm => arm === 'gloss_title').length
      expect(gloss_arm_count).toBeGreaterThan(400)
      expect(gloss_arm_count).toBeLessThan(600)
    })
  })

  describe(seo_entry_title, () => {
    const gloss_entry = (id: string, glosses: Record<string, string>) => ({
      id,
      senses: [{ glosses }],
    }) as DeepPartial<EntryData>

    const gloss_arm_id = (() => {
      let index = 0
      while (entry_title_test_arm(`seed-${index}`) !== 'gloss_title') index++
      return `seed-${index}`
    })()
    const control_arm_id = (() => {
      let index = 0
      while (entry_title_test_arm(`seed-${index}`) !== 'control') index++
      return `seed-${index}`
    })()

    test('gloss arm surfaces the first gloss with its language', () => {
      const title = seo_entry_title({
        entry: gloss_entry(gloss_arm_id, { en: 'Niece (Sister’s daughter)' }),
        headword: 'भांजी (Bhanji)',
        gloss_languages: ['en', 'hi'],
        t,
      })
      expect(title).toBe('भांजी (Bhanji) means “Niece” in English')
    })

    test('control arm returns null', () => {
      expect(seo_entry_title({
        entry: gloss_entry(control_arm_id, { en: 'Niece' }),
        headword: 'भांजी',
        gloss_languages: ['en'],
        t,
      })).toBe(null)
    })

    test('falls back to dictionary language order and localized names', () => {
      const title = seo_entry_title({
        entry: gloss_entry(gloss_arm_id, { hi: 'ननद' }),
        headword: 'nanad',
        gloss_languages: ['en', 'hi'],
        t,
      })
      expect(title).toBe('nanad means “ननद” in Hindi')
    })

    test('null for glossless, empty-after-cleaning, and over-long glosses', () => {
      expect(seo_entry_title({ entry: gloss_entry(gloss_arm_id, {}), headword: 'x', gloss_languages: ['en'], t })).toBe(null)
      expect(seo_entry_title({ entry: gloss_entry(gloss_arm_id, { en: '(archaic)' }), headword: 'x', gloss_languages: ['en'], t })).toBe(null)
      expect(seo_entry_title({ entry: gloss_entry(gloss_arm_id, { en: 'a'.repeat(60) }), headword: 'x', gloss_languages: ['en'], t })).toBe(null)
    })

    test('takes only the first list segment and strips italic tags', () => {
      const title = seo_entry_title({
        entry: gloss_entry(gloss_arm_id, { en: '<i>Wednesday</i>, midweek day' }),
        headword: 'বুধবার',
        gloss_languages: ['en'],
        t,
      })
      expect(title).toBe('বুধবার means “Wednesday” in English')
    })
  })
}
