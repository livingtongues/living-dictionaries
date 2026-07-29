import { describe, expect, test } from 'vitest'
import { build_section_tree } from './grammar-tree'
import type { GrammarSectionLike } from './grammar-tree'
import { active_breadcrumb, active_chapter_id, build_toc_entries, CLAUSE_TEMPLATE_ANCHOR, GLOSSING_LEGEND_ANCHOR } from './grammar-toc'
import { initial_keys } from '$lib/api/v1/fractional-index'

function section(id: string, parent_id: string | null, sort_key: string, title: string | null): GrammarSectionLike {
  return { id, parent_id, sort_key, title: title === null ? null : { en: title } }
}

/** Ponca's shape in miniature: a preface + two chapters, each with subsections. */
function ponca_like() {
  const [a, b, c] = initial_keys(3)
  return build_section_tree([
    section('preface', null, a, null),
    section('pronunciation', null, b, 'PRONUNCIATION GUIDE'),
    section('verb', null, c, 'THE PONCA VERB'),
    section('vowels', 'pronunciation', a, 'Vowels'),
    section('stops', 'pronunciation', b, 'Stops'),
    section('paradigm', 'verb', a, 'Basic paradigm'),
  ])
}

describe(build_toc_entries, () => {
  test('lists chapters only, skipping the untitled preface', () => {
    const entries = build_toc_entries({ tree: ponca_like(), active_id: null })
    expect(entries.map(entry => entry.label)).toEqual(['PRONUNCIATION GUIDE', 'THE PONCA VERB'])
    expect(entries.map(entry => entry.number)).toEqual(['1', '2'])
  })

  test('expands only the active chapter', () => {
    const entries = build_toc_entries({ tree: ponca_like(), active_id: 'pronunciation' })
    expect(entries.map(entry => entry.label)).toEqual(['PRONUNCIATION GUIDE', 'Vowels', 'Stops', 'THE PONCA VERB'])
    expect(entries.map(entry => entry.depth)).toEqual([0, 1, 1, 0])
  })

  test('expands the chapter that CONTAINS the active subsection and marks it active', () => {
    const entries = build_toc_entries({ tree: ponca_like(), active_id: 'stops' })
    expect(entries.map(entry => entry.label)).toEqual(['PRONUNCIATION GUIDE', 'Vowels', 'Stops', 'THE PONCA VERB'])
    expect(entries.find(entry => entry.id === 'stops')?.is_active).toBeTruthy()
    expect(entries.find(entry => entry.id === 'pronunciation')?.is_active).toBeFalsy()
  })

  test('pins the clause template and glossing legend below the chapters, in render order', () => {
    const entries = build_toc_entries({
      tree: ponca_like(),
      active_id: null,
      clause_template_label: 'Clause template',
      glossing_legend_label: 'Glossing abbreviations',
    })
    expect(entries.map(entry => entry.id)).toEqual([
      'pronunciation',
      'verb',
      CLAUSE_TEMPLATE_ANCHOR,
      GLOSSING_LEGEND_ANCHOR,
    ])
  })

  test('omits the pinned entries when their labels are blank', () => {
    const entries = build_toc_entries({ tree: ponca_like(), active_id: null })
    expect(entries.some(entry => entry.id === CLAUSE_TEMPLATE_ANCHOR)).toBeFalsy()
    expect(entries.some(entry => entry.id === GLOSSING_LEGEND_ANCHOR)).toBeFalsy()
  })

  test('prefers the requested gloss language for labels', () => {
    const [a] = initial_keys(1)
    const tree = build_section_tree([
      { id: 'r', parent_id: null, sort_key: a, title: { en: 'Verbs', es: 'Verbos' } },
    ])
    const entries = build_toc_entries({ tree, active_id: null, prefer_languages: ['es'] })
    expect(entries[0].label).toBe('Verbos')
  })
})

describe(active_chapter_id, () => {
  test('resolves a grandchild up to its top-level chapter', () => {
    expect(active_chapter_id({ tree: ponca_like(), active_id: 'paradigm' })).toBe('verb')
  })

  test('returns null when nothing is active', () => {
    expect(active_chapter_id({ tree: ponca_like(), active_id: null })).toBeNull()
    expect(active_chapter_id({ tree: ponca_like(), active_id: 'nonexistent' })).toBeNull()
  })
})

describe(active_breadcrumb, () => {
  test('names the deepest active section', () => {
    expect(active_breadcrumb({ tree: ponca_like(), active_id: 'stops' })).toEqual({ number: '1.2', label: 'Stops' })
  })

  test('falls back to the chapter when the active section is untitled', () => {
    expect(active_breadcrumb({ tree: ponca_like(), active_id: 'preface' })).toBeNull()
    expect(active_breadcrumb({ tree: ponca_like(), active_id: 'verb' })).toEqual({ number: '2', label: 'THE PONCA VERB' })
  })
})
