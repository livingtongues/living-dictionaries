export const review_category_labels: Record<string, string> = {
  dropped_text: 'Text left out',
  headword_in_gloss: 'Enxet text in Spanish',
  language_split: 'Language split',
  missing_gloss: 'Missing translation',
  other: 'Other',
  truncated: 'Possibly incomplete',
  uncertain_gloss: 'Uncertain translation',
  uncertain_plural: 'Plural form',
}

export function get_review_category_label(category: string): string {
  const key = category.trim()
  if (!key) return ''
  if (review_category_labels[key]) return review_category_labels[key]
  const readable = key.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  return readable[0].toUpperCase() + readable.slice(1)
}

if (import.meta.vitest) {
  describe(get_review_category_label, () => {
    it('uses the human label for a known category', () => {
      expect(get_review_category_label('headword_in_gloss')).toBe('Enxet text in Spanish')
    })

    it('makes an unknown category readable', () => {
      expect(get_review_category_label('possible_source-MIXUP')).toBe('Possible source MIXUP')
    })

    it('returns an empty label for an empty category', () => {
      expect(get_review_category_label('  ')).toBe('')
    })
  })
}
