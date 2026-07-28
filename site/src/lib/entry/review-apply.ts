import type { EntryReview, EntryReviewApply, EntryReviewComparison, MultiString } from '$lib/db/schemas/dictionary.types'

interface EntryValues {
  lexeme?: MultiString | null
  phonetic?: string | null
}

interface SenseValues {
  glosses?: MultiString | null
  definition?: MultiString | null
}

/** The value the entry currently holds for a comparison's target — marks which version is in use. */
export function get_review_target_value({ apply, entry, sense }: { apply?: EntryReviewApply, entry: EntryValues, sense?: SenseValues | null }): string | undefined {
  if (!apply) return undefined
  switch (apply.target) {
    case 'entry.phonetic':
      return entry.phonetic ?? undefined
    case 'entry.lexeme':
      return apply.key ? entry.lexeme?.[apply.key] : undefined
    case 'sense.glosses':
      return apply.key ? sense?.glosses?.[apply.key] : undefined
    case 'sense.definition':
      return apply.key ? sense?.definition?.[apply.key] : undefined
  }
}

/**
 * Drop a comparison the reviewer just settled. A review whose comparisons are
 * all settled has nothing left to ask, so it clears entirely (`null`) — same as
 * pressing Resolve.
 */
export function remove_review_comparison({ review, comparison }: { review: EntryReview, comparison: EntryReviewComparison }): EntryReview | null {
  const remaining = (review.comparisons ?? []).filter(item => item !== comparison)
  if (!remaining.length) return null
  return { ...review, comparisons: remaining }
}

if (import.meta.vitest) {
  const comparison_a: EntryReviewComparison = {
    field: 'Definition',
    a: { label: 'Main', value: 'one' },
    b: { label: 'Finder', value: 'two' },
    apply: { target: 'sense.definition', sense_id: 'sense-1', key: 'en' },
  }
  const comparison_b: EntryReviewComparison = {
    field: 'Pronunciation guide',
    a: { label: 'Main', value: 'äʼ-bä' },
    b: { label: 'Finder', value: 'äʼ-bā' },
    apply: { target: 'entry.lexeme', key: 'pronunciation' },
  }

  describe(get_review_target_value, () => {
    it('reads an entry-level orthography', () => {
      expect(get_review_target_value({ apply: comparison_b.apply, entry: { lexeme: { default: 'Ábačižè', pronunciation: 'äʼ-bä' } } })).toBe('äʼ-bä')
    })
    it('reads a sense definition in the right language', () => {
      expect(get_review_target_value({ apply: comparison_a.apply, entry: {}, sense: { definition: { en: 'one', es: 'uno' } } })).toBe('one')
    })
    it('reads phonetic', () => {
      expect(get_review_target_value({ apply: { target: 'entry.phonetic' }, entry: { phonetic: 'xaʔ' } })).toBe('xaʔ')
    })
    it('returns undefined without an apply target or a matching sense', () => {
      expect(get_review_target_value({ entry: {} })).toBe(undefined)
      expect(get_review_target_value({ apply: comparison_a.apply, entry: {}, sense: null })).toBe(undefined)
    })
  })

  describe(remove_review_comparison, () => {
    it('keeps the review when other comparisons remain', () => {
      const review: EntryReview = { category: 'definition-differs', note: 'x', comparisons: [comparison_a, comparison_b] }
      expect(remove_review_comparison({ review, comparison: comparison_a })).toEqual({ ...review, comparisons: [comparison_b] })
    })
    it('clears the review once the last comparison is settled', () => {
      const review: EntryReview = { category: 'definition-differs', note: 'x', comparisons: [comparison_a] }
      expect(remove_review_comparison({ review, comparison: comparison_a })).toBe(null)
    })
  })
}
