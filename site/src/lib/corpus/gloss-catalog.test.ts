import type { TranslateFunction } from '$lib/i18n/types'
import { mock_t } from '$lib/mocks/mock-t'
import { build_gloss_catalog } from './gloss-catalog'

const t = mock_t as TranslateFunction

const ponca_legend = [
  { code: '1SG', name: { en: 'first person singular (Ponca)' } },
  { code: '3', name: { en: 'third person' } },
  { code: 'PL.EMPH', name: { en: 'plural emphatic' } },
]

describe(build_gloss_catalog, () => {
  test('a dictionary row overrides the standard catalog, standard fills the gaps', () => {
    const catalog = build_gloss_catalog({ legend: ponca_legend, language: 'en', t })
    expect(catalog.expand('1SG')).toBe('first person singular (Ponca)')
    expect(catalog.expand('PST')).toBe('past')
    expect(catalog.expand('PL.EMPH')).toBe('plural emphatic')
    expect(catalog.expand('ZZZ')).toBe('')
  })

  test('a dictionary with no legend still expands the standard codes', () => {
    const catalog = build_gloss_catalog({ legend: [], language: null, t })
    expect(catalog.expand('1PL')).toBe('first person plural')
    expect(catalog.split_field('1PL-run')).toEqual([
      { text: '1PL', code: '1PL' },
      { text: '-run' },
    ])
  })

  test('composes a dot-composite from its parts when no row spells it out', () => {
    const catalog = build_gloss_catalog({ legend: ponca_legend, language: 'en', t })
    expect(catalog.expand('1PL.PST')).toBe('first person plural · past')
    expect(catalog.expand('1SG.PST')).toBe('first person singular (Ponca) · past')
    expect(catalog.expand('1PL.ZZZ')).toBe('')
    expect(catalog.has('1PL.PST')).toBeTruthy()
  })

  test('a gloss cell takes an ambiguous standard code, a free-text field does not', () => {
    const catalog = build_gloss_catalog({ legend: [], language: 'en', t })
    expect(catalog.split_gloss_cell('A eat')).toEqual([{ text: 'A', code: 'A' }, { text: ' eat' }])
    expect(catalog.split_field('A stem is doubled')).toEqual([{ text: 'A stem is doubled' }])
  })

  test('prose never lights up a one-character curated code, or a code inside a word', () => {
    const catalog = build_gloss_catalog({ legend: ponca_legend, language: 'en', t })
    expect(catalog.split_prose('There are 3 stems, all PL forms.')).toEqual([
      { text: 'There are 3 stems, all ' },
      { text: 'PL', code: 'PL' },
      { text: ' forms.' },
    ])
    expect(catalog.split_prose('a PLUME of dust')).toEqual([{ text: 'a PLUME of dust' }])
  })

  test('prose matches a curated code that a standard one is nested in', () => {
    const catalog = build_gloss_catalog({ legend: [{ code: '1SG.SBJ', name: { en: 'first person singular subject' } }], language: 'en', t })
    expect(catalog.split_prose('the 1SG.SBJ prefix')).toEqual([
      { text: 'the ' },
      { text: '1SG.SBJ', code: '1SG.SBJ' },
      { text: ' prefix' },
    ])
  })

  test('a curated row that merely restates the standard wording defers to the localized standard expansion', () => {
    const catalog = build_gloss_catalog({
      legend: [
        { code: '1SG', name: { default: 'first person singular' } },
        { code: 'REFL', name: { default: 'reflexive — kig- "subject acts on self"' } },
      ],
      language: 'en',
      t: ((options: { dynamicKey?: string, fallback?: string }) => `LOCALIZED ${options.fallback}`) as TranslateFunction,
    })
    expect(catalog.expand('1SG')).toBe('LOCALIZED first person singular')
    expect(catalog.expand('REFL')).toBe('reflexive — kig- "subject acts on self"')
  })

  test('standard_codes_used collects standard codes from cells and prose, skipping bespoke curated ones', () => {
    const catalog = build_gloss_catalog({ legend: ponca_legend, language: 'en', t })
    expect(catalog.standard_codes_used({
      gloss_cells: ['1SG.SBJ-REFL-lift', 'eat PFV'],
      prose: ['The PST marker follows the stem.'],
    })).toEqual(['PFV', 'PST', 'REFL', 'SBJ']) // 1SG is curated-bespoke → excluded
    expect(catalog.standard_codes_used({})).toEqual([])
  })

  test('standard_codes_used excludes every curated code — even a restatement (the curated table shows it)', () => {
    const catalog = build_gloss_catalog({ legend: [{ code: 'PL', name: { default: 'plural' } }], language: 'en', t })
    expect(catalog.standard_codes_used({ gloss_cells: ['walk PL', 'eat PFV'] })).toEqual(['PFV'])
  })

  test('curated codes still match anywhere inside a gloss cell', () => {
    const catalog = build_gloss_catalog({ legend: [{ code: 'PL', name: { en: 'plural' } }], language: 'en', t })
    expect(catalog.split_gloss_cell('walkPL')).toEqual([{ text: 'walk' }, { text: 'PL', code: 'PL' }])
  })
})
