import type { MultiString } from '$lib/types'

/**
 * Lexeme index for linking ENTRY MENTIONS inside authored prose (the grammar
 * page today, other rich text later).
 *
 * Deliberately NOT the corpus matcher's index: `normalized_word_key`
 * (tokenize-sentence.ts) strips diacritics and folds IPA so that a transcribed
 * sentence still finds its entry. That recall is right for a corpus and
 * disastrous here — grammar prose is mostly ENGLISH, and diacritic-folding
 * makes Ponca's `Méʼ` collide with the English word "me", `Séʼ` with "se",
 * every single-letter alphabet entry with "a"/"I". So this index keys on the
 * form as written: NFC + lowercase + apostrophe unification, nothing more.
 *
 * Guards on top of the exact key (see `is_linkable_key`): a short pure-ASCII
 * form only links where the author MARKED it (bold/italic), which is the
 * convention linguists already write with — "the letter **a**" links, the
 * article "a" in running prose never does.
 */

// Same variants the corpus matcher unifies: orthographies mix straight
// apostrophe, right single quote and modifier letters (saltillo/ʻokina) freely.
const APOSTROPHE_VARIANTS = /[’ʼʻ‘`´]/g
const WORD_MATCH = /[\p{L}\p{M}\p{N}]+(?:['’ʻ-][\p{L}\p{M}\p{N}]+)*/gu
const NON_ASCII = /[^\u0020-\u007E]/

/** Longest form (in words) we will try to match as a phrase. */
export const MAX_PHRASE_WORDS = 6

/** Below this length a pure-ASCII form is too collision-prone for running prose. */
const SHORT_ASCII_MAX = 2

export interface EntryLinkIndex {
  /** exact key (space-joined words) → entry ids sharing that written form */
  by_form: Map<string, string[]>
  /** longest indexed lexeme in words — bounds the n-gram search */
  max_word_count: number
}

/**
 * The comparison key for one written form: unicode-normalized, lowercased,
 * apostrophe variants unified, edge apostrophes dropped. Diacritics are KEPT —
 * that is the whole point.
 */
export function exact_form_key(form: string): string {
  return form
    .normalize('NFC')
    .toLowerCase()
    .replace(APOSTROPHE_VARIANTS, '\'')
    .replace(/^'+|'+$/g, '')
}

/**
 * Words of a form, keyed and space-joined — identical for "Đihą́" / "đihą́".
 * Edge hyphens fall away on BOTH sides (the word pattern must start and end on
 * a letter/digit), so the affix entry `-čábe` and a bare "čábe" in prose share
 * a key, as do the prefix entry `A-` and a bolded "**A-**".
 */
export function exact_word_key(form: string): string {
  const words = form.match(WORD_MATCH) ?? []
  return words.map(exact_form_key).filter(Boolean).join(' ')
}

/**
 * May this key be linked in UNMARKED prose? Short pure-ASCII forms (the
 * alphabet entries a/b/e/i, English-colliding stubs) may only link inside an
 * author-marked span. Anything carrying a diacritic or ≥3 chars is distinctive
 * enough to link anywhere.
 */
export function is_linkable_key({ key, marked }: { key: string, marked: boolean }): boolean {
  if (marked) return true
  if (NON_ASCII.test(key)) return true
  return key.replace(/[^a-z0-9]/g, '').length > SHORT_ASCII_MAX
}

export function build_entry_link_index(entries: { id: string, lexeme: MultiString | null }[]): EntryLinkIndex {
  const by_form = new Map<string, string[]>()
  let max_word_count = 1
  for (const entry of entries) {
    const seen = new Set<string>()
    for (const value of Object.values(entry.lexeme ?? {})) {
      if (!value?.trim()) continue
      const key = exact_word_key(value)
      if (!key || seen.has(key)) continue
      seen.add(key)
      const words = key.split(' ').length
      if (words > MAX_PHRASE_WORDS) continue
      if (words > max_word_count) max_word_count = words
      const ids = by_form.get(key)
      if (ids) {
        if (!ids.includes(entry.id)) ids.push(entry.id)
      } else {
        by_form.set(key, [entry.id])
      }
    }
  }
  return { by_form, max_word_count }
}

if (import.meta.vitest) {
  describe(exact_form_key, () => {
    it('lowercases and unifies apostrophes but KEEPS diacritics', () => {
      expect(exact_form_key('Đihą́')).toBe('đihą́')
      expect(exact_form_key('Tʼą́đi')).toBe('t\'ą́đi')
      expect(exact_form_key('Tʼą́đi')).toBe(exact_form_key('T’ą́đi'))
    })

    it('does NOT fold a diacritic form onto its bare-ASCII lookalike', () => {
      expect(exact_form_key('Méʼ')).not.toBe('me')
      expect(exact_form_key('Séʼ')).not.toBe('se')
    })
  })

  describe(is_linkable_key, () => {
    it('blocks short pure-ASCII forms in unmarked prose', () => {
      expect(is_linkable_key({ key: 'a', marked: false })).toBe(false)
      expect(is_linkable_key({ key: 'i', marked: false })).toBe(false)
      expect(is_linkable_key({ key: 'be', marked: false })).toBe(false)
    })

    it('allows those same forms where the author marked them', () => {
      expect(is_linkable_key({ key: 'a', marked: true })).toBe(true)
    })

    it('allows any form carrying a diacritic, however short', () => {
      expect(is_linkable_key({ key: 'ą', marked: false })).toBe(true)
      expect(is_linkable_key({ key: 'đá', marked: false })).toBe(true)
    })

    it('allows longer ascii forms in plain prose', () => {
      expect(is_linkable_key({ key: 'nak', marked: false })).toBe(true)
    })
  })

  describe(build_entry_link_index, () => {
    const index = build_entry_link_index([
      { id: 'e1', lexeme: { default: 'Đihą́' } },
      { id: 'e2', lexeme: { default: '-čábe' } },
      { id: 'e3', lexeme: { default: 'Đįgé gáxe' } },
      { id: 'e4', lexeme: { default: 'Gíđe', alt: 'Giđe' } },
      { id: 'e5', lexeme: { default: 'gíđe' } },
    ])

    it('keys forms exactly, case-folded', () => {
      expect(index.by_form.get('đihą́')).toEqual(['e1'])
    })

    it('keys affixes bare, so `-čábe` in the entry matches "čábe" in prose', () => {
      expect(index.by_form.get('čábe')).toEqual(['e2'])
      expect(exact_word_key('-čábe')).toBe('čábe')
      expect(exact_word_key('A-')).toBe('a')
    })

    it('tracks the longest phrase and indexes multi-word lexemes', () => {
      expect(index.max_word_count).toBe(2)
      expect(index.by_form.get('đįgé gáxe')).toEqual(['e3'])
    })

    it('collects homographs across entries and orthographies', () => {
      expect(index.by_form.get('gíđe')).toEqual(['e4', 'e5'])
      expect(index.by_form.get('giđe')).toEqual(['e4'])
    })
  })
}
