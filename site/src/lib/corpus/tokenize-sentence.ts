import type { MultiString } from '$lib/types'
import type { SentenceToken } from '$lib/db/schemas/dictionary.types'
import { PRIMARY_ORTHOGRAPHY_CODE } from '$lib/db/schemas/shared.types'
import { simplify_lexeme_for_search } from '$lib/search/augment-entry-for-search'

/**
 * Word tokenizer for the corpus matching pipeline
 * (.issues/texts-sentences-pipeline.md M3). Deliberately naive v1: words are
 * runs of letters/marks/digits (word-internal apostrophes and hyphens stay in
 * the word); everything else non-whitespace becomes punctuation tokens with
 * `status: 'ignored'` so char offsets and timing arrays stay complete.
 * FUTURE: `Intl.Segmenter` for no-space scripts.
 */

// A word: letter/mark/digit runs, allowing internal apostrophes/hyphens
// (glottal stops and compounds: "kwaq'a", "nak-tore").
const WORD_MATCH = /[\p{L}\p{M}\p{N}]+(?:['’ʻ-][\p{L}\p{M}\p{N}]+)*/gu
const HAS_WORD_CHAR = /[\p{L}\p{M}\p{N}]/u

/** True when a token is punctuation (no word characters at all). */
export function is_punctuation_form(form: string): boolean {
  return !HAS_WORD_CHAR.test(form)
}

// Apostrophe-like variants unified for comparison: orthographies mix straight
// apostrophe, right single quote, modifier letters (saltillo/ʻokina) freely —
// e.g. achi entries store "juyub’" while sentence text has "juyubʼ".
const APOSTROPHE_VARIANTS = /[’ʼʻ‘`´]/g

/**
 * Normalize a surface form the same way the Orama index normalizes lexemes
 * (lowercase, diacritics stripped, IPA→keyboard chars) plus apostrophe-variant
 * unification, so token forms and lexeme forms compare identically.
 */
export function normalize_token_form(form: string): string {
  // Word-EDGE apostrophes are stripped after unification: WORD_MATCH already
  // drops a trailing straight/curly apostrophe ("Juyub'" keys as "juyub") but
  // keeps modifier letters like U+02BC ("juyubʼ" stays whole — category Lm) —
  // without the strip the two spellings of one word normalize to different keys.
  const lowered = form.toLowerCase().replace(APOSTROPHE_VARIANTS, '\'').replace(/^'+|'+$/g, '')
  return simplify_lexeme_for_search(lowered) ?? lowered
}

/** Word portions of a form, normalized and space-joined — the matcher/carry-over
 *  comparison key (identical for `"nak tore"`, `"Nak, toré"`, a merged phrase token…). */
export function normalized_word_key(form: string): string {
  const words = form.match(WORD_MATCH) ?? []
  return words.map(normalize_token_form).join(' ')
}

/** Number of words in a lexeme/form (0 = pure punctuation). */
export function word_count(form: string): number {
  return (form.match(WORD_MATCH) ?? []).length
}

/** Tokenize one orthography's sentence text into offset-complete tokens. */
export function tokenize_sentence_text(text: string): SentenceToken[] {
  const tokens: SentenceToken[] = []
  let cursor = 0

  function push_gap(gap_start: number, gap_end: number) {
    const gap = text.slice(gap_start, gap_end)
    const punct_match = /\S+/g
    let punct: RegExpExecArray | null = punct_match.exec(gap)
    while (punct) {
      tokens.push({
        form: punct[0],
        start: gap_start + punct.index,
        end: gap_start + punct.index + punct[0].length,
        status: 'ignored',
      })
      punct = punct_match.exec(gap)
    }
  }

  WORD_MATCH.lastIndex = 0
  let word: RegExpExecArray | null = WORD_MATCH.exec(text)
  while (word) {
    if (word.index > cursor)
      push_gap(cursor, word.index)
    tokens.push({ form: word[0], start: word.index, end: word.index + word[0].length })
    cursor = word.index + word[0].length
    word = WORD_MATCH.exec(text)
  }
  if (cursor < text.length)
    push_gap(cursor, text.length)

  return tokens
}

/**
 * The orthography code to tokenize/display for a sentence: `default` when
 * populated, otherwise the first populated key (matching `get_headword`'s
 * promotion behavior without needing the registry).
 */
export function pick_tokenization_orthography(text: MultiString | null | undefined): string | null {
  if (text?.[PRIMARY_ORTHOGRAPHY_CODE]?.trim())
    return PRIMARY_ORTHOGRAPHY_CODE
  for (const [code, value] of Object.entries(text ?? {})) {
    if (value?.trim())
      return code
  }
  return null
}

if (import.meta.vitest) {
  describe(tokenize_sentence_text, () => {
    test('words and punctuation with complete offsets', () => {
      expect(tokenize_sentence_text('Nak tore, kaq!')).toEqual([
        { form: 'Nak', start: 0, end: 3 },
        { form: 'tore', start: 4, end: 8 },
        { form: ',', start: 8, end: 9, status: 'ignored' },
        { form: 'kaq', start: 10, end: 13 },
        { form: '!', start: 13, end: 14, status: 'ignored' },
      ])
    })

    test('word-internal apostrophes and hyphens stay in the word', () => {
      expect(tokenize_sentence_text('kwaq’a nak-tore')).toEqual([
        { form: 'kwaq’a', start: 0, end: 6 },
        { form: 'nak-tore', start: 7, end: 15 },
      ])
    })

    test('leading/trailing punctuation and quotes are separate ignored tokens', () => {
      expect(tokenize_sentence_text('“Nak?”')).toEqual([
        { form: '“', start: 0, end: 1, status: 'ignored' },
        { form: 'Nak', start: 1, end: 4 },
        { form: '?”', start: 4, end: 6, status: 'ignored' },
      ])
    })

    test('diacritics and non-latin scripts are words', () => {
      expect(tokenize_sentence_text('toré ᱯᱚ')).toEqual([
        { form: 'toré', start: 0, end: 4 },
        { form: 'ᱯᱚ', start: 5, end: 7 },
      ])
    })

    test('empty and whitespace-only input yields nothing', () => {
      expect(tokenize_sentence_text('')).toEqual([])
      expect(tokenize_sentence_text('   ')).toEqual([])
    })
  })

  describe(normalize_token_form, () => {
    test('lowercases and strips diacritics like the search index', () => {
      expect(normalize_token_form('Toré')).toBe('tore')
      expect(normalize_token_form('NAK')).toBe('nak')
      expect(normalize_token_form('ʃiʃ')).toBe('sis')
    })

    test('apostrophe variants unify (U+2019 lexeme matches U+02BC token)', () => {
      expect(normalize_token_form('juyub’')).toBe(normalize_token_form('juyubʼ'))
      expect(normalize_token_form('kʼo')).toBe("k'o")
    })

    test('edge apostrophes strip so lexeme "Juyub\'" (WORD_MATCH drops the tail) matches token "juyubʼ" (Lm letter kept)', () => {
      expect(normalize_token_form('juyubʼ')).toBe('juyub')
      expect(normalized_word_key("Juyub'")).toBe(normalized_word_key('juyubʼ'))
      expect(normalized_word_key("K'uluj nee'")).toBe(normalized_word_key('kʼuluj neeʼ'))
      // internal apostrophes survive
      expect(normalize_token_form("b'alam")).toBe("b'alam")
    })
  })

  describe(normalized_word_key, () => {
    test('joins normalized word portions, dropping punctuation', () => {
      expect(normalized_word_key('Nak, toré!')).toBe('nak tore')
      expect(normalized_word_key('...')).toBe('')
    })
  })

  describe(word_count, () => {
    test('counts words, not punctuation', () => {
      expect(word_count('nak tore')).toBe(2)
      expect(word_count('nak, tore!')).toBe(2)
      expect(word_count('?!')).toBe(0)
    })
  })

  describe(pick_tokenization_orthography, () => {
    test('prefers default, falls back to first populated, null when empty', () => {
      expect(pick_tokenization_orthography({ default: 'nak', other: 'x' })).toBe('default')
      expect(pick_tokenization_orthography({ 'default': '', 'sat-Olck': 'ᱯᱚ' })).toBe('sat-Olck')
      expect(pick_tokenization_orthography({})).toBeNull()
      expect(pick_tokenization_orthography(null)).toBeNull()
    })
  })

  describe(is_punctuation_form, () => {
    test('detects punctuation-only forms', () => {
      expect(is_punctuation_form('?!')).toBe(true)
      expect(is_punctuation_form('nak')).toBe(false)
      expect(is_punctuation_form('ᱯᱚ')).toBe(false)
    })
  })
}
