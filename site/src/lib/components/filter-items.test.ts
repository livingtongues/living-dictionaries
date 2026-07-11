import { glossing_languages } from '$lib/glosses/glossing-languages'
import { english_translate } from '$lib/i18n'
import { filter_items } from './filter-items'

// Mirrors how EditableGlossesField builds the items it hands to <Filter>: the
// raw gloss record plus the localized (English) display name shown in the
// parenthetical. The localizedName is what makes a language searchable by its
// English name (the original bug: typing "Mandarin" never surfaced 中文 / cmn).
const raw_items = Object.entries(glossing_languages).map(([bcp, value]) => ({ bcp, ...value }))
const enriched_items = raw_items.map(item => ({
  ...item,
  localizedName: english_translate({ dynamicKey: `gl.${item.bcp}`, fallback: item.bcp }),
}))

describe(filter_items, () => {
  test('finds Chinese (cmn) by its English name "Mandarin" once localizedName is searchable', () => {
    const matches = filter_items({ items: enriched_items, query: 'Mandar' })
    expect(matches.map(match => match.bcp)).toContain('cmn')
  })

  test('regression guard: cmn was NOT findable by "Mandarin" before enrichment', () => {
    const matches = filter_items({ items: raw_items, query: 'Mandar' })
    expect(matches.map(match => match.bcp)).not.toContain('cmn')
  })

  test('still matches by the vernacular spelling (中文)', () => {
    const matches = filter_items({ items: enriched_items, query: '中文' })
    expect(matches.map(match => match.bcp)).toContain('cmn')
  })

  test('is case-insensitive', () => {
    expect(filter_items({ items: enriched_items, query: 'MANDARIN' }).map(match => match.bcp)).toContain('cmn')
  })
})
