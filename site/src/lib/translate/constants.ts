import { UnpublishedLocales } from '$lib/i18n/locales'

/** Friendly names for the sheet-tab-era key sections; other sections are humanized from their key. */
const SECTION_LABELS: Record<string, string> = {
  gl: 'Glossing languages',
  ps: 'Parts of speech',
  psAbbrev: 'Parts of speech — abbreviations',
  sd: 'Semantic domains',
}

export function section_label(section: string): string {
  if (SECTION_LABELS[section])
    return SECTION_LABELS[section]
  const humanized = section.replace(/_/g, ' ')
  return humanized.charAt(0).toUpperCase() + humanized.slice(1)
}

export const TRANSLATE_FILTERS = ['all', 'pending', 'missing', 'ai', 'en_changed'] as const
export type TranslateFilter = typeof TRANSLATE_FILTERS[number]

export const FILTER_LABELS: Record<TranslateFilter, string> = {
  all: 'All',
  pending: 'Needs attention',
  missing: 'Untranslated',
  ai: 'AI translation',
  en_changed: 'English changed',
}

/**
 * The four mutually-exclusive states a key can be in for a locale (they sum to
 * the total). The colored progress bar, the mini card bars, and the legend
 * filter chips all key off these, so the palette lives in one place.
 * `reviewed` has no filter (nothing to act on); the other three each map to a
 * `TranslateFilter`.
 */
export const PROGRESS_CATEGORIES = ['reviewed', 'ai', 'en_changed', 'missing'] as const
export type ProgressCategory = typeof PROGRESS_CATEGORIES[number]

export interface ProgressCategoryMeta {
  label: string
  /** CSS color, referencing a `--cat-*` custom property with a hardcoded fallback for isolated stories. */
  color: string
  /** The filter chip this segment activates, if any. */
  filter: TranslateFilter | null
}

export const PROGRESS_CATEGORY_META: Record<ProgressCategory, ProgressCategoryMeta> = {
  reviewed: { label: 'Reviewed', color: 'var(--cat-reviewed, hsl(142, 71%, 40%))', filter: null },
  ai: { label: 'AI translation', color: 'var(--cat-ai, hsl(258, 70%, 60%))', filter: 'ai' },
  en_changed: { label: 'English changed', color: 'var(--cat-en-changed, hsl(38, 80%, 45%))', filter: 'en_changed' },
  missing: { label: 'Untranslated', color: 'var(--cat-missing, hsl(240, 6%, 65%))', filter: 'missing' },
}

/** Per-category counts for one locale; always sums to `total`. */
export interface ProgressCounts {
  reviewed: number
  ai: number
  en_changed: number
  missing: number
}

// AI-translation trust, from an agent self-assessment across every translatable locale.
export type AiConfidence = 'confident' | 'decent' | 'low'

export interface AiConfidenceMeta {
  label: string
  tooltip: string
}

export const AI_CONFIDENCE_META: Record<AiConfidence, AiConfidenceMeta> = {
  confident: { label: 'Confident', tooltip: 'AI confidence: Confident — machine drafts are usually reliable.' },
  decent: { label: 'Decent — review advised', tooltip: 'AI confidence: Decent — well-resourced, but idiom/register can slip. Review advised.' },
  low: { label: 'Don\'t trust unreviewed', tooltip: 'AI confidence: Low — lower-resourced; drafts are a starting point but need a native/fluent reviewer.' },
}

const AI_CONFIDENCE_BY_LOCALE: Record<AiConfidence, string[]> = {
  confident: ['es', 'fr', 'de', 'pt', 'zh', 'ru', 'hi', 'vi', 'id', 'ms', 'ar', 'he', 'bn'],
  decent: ['sw'],
  low: ['as', 'or', 'am', 'ha'],
}

const CONFIDENCE_LOOKUP: Record<string, AiConfidence> = Object.fromEntries(
  Object.entries(AI_CONFIDENCE_BY_LOCALE).flatMap(([level, locales]) => locales.map(locale => [locale, level as AiConfidence])),
)

export function ai_confidence_for(locale: string): AiConfidence | null {
  return CONFIDENCE_LOOKUP[locale] ?? null
}

export function is_unpublished_locale(locale: string): boolean {
  return locale in UnpublishedLocales
}

if (import.meta.vitest) {
  describe(section_label, () => {
    test('known sections get friendly names, others are humanized', () => {
      expect(section_label('psAbbrev')).toBe('Parts of speech — abbreviations')
      expect(section_label('relationship_type')).toBe('Relationship type')
      expect(section_label('misc')).toBe('Misc')
    })
  })

  describe(ai_confidence_for, () => {
    test('every translatable locale is classified into exactly one group', () => {
      expect(ai_confidence_for('es')).toBe('confident')
      expect(ai_confidence_for('sw')).toBe('decent')
      expect(ai_confidence_for('ha')).toBe('low')
      expect(ai_confidence_for('en')).toBe(null)
    })
  })

  describe(is_unpublished_locale, () => {
    test('flags the unpublished locales only', () => {
      expect(is_unpublished_locale('ha')).toBe(true)
      expect(is_unpublished_locale('am')).toBe(true)
      expect(is_unpublished_locale('es')).toBe(false)
    })
  })
}
