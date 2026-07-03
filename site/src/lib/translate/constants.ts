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

export const TRANSLATE_FILTERS = ['all', 'pending', 'missing', 'flagged'] as const
export type TranslateFilter = typeof TRANSLATE_FILTERS[number]

export const FILTER_LABELS: Record<TranslateFilter, string> = {
  all: 'All',
  pending: 'Needs attention',
  missing: 'Untranslated',
  flagged: 'To review',
}

if (import.meta.vitest) {
  describe(section_label, () => {
    test('known sections get friendly names, others are humanized', () => {
      expect(section_label('psAbbrev')).toBe('Parts of speech — abbreviations')
      expect(section_label('relationship_type')).toBe('Relationship type')
      expect(section_label('misc')).toBe('Misc')
    })
  })
}
