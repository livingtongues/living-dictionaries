import type { AlignConfig } from '$lib/db/schemas/shared.types'
import type { SentenceToken } from '$lib/db/schemas/dictionary.types'
import { is_punctuation_form } from '$lib/corpus/tokenize-sentence'
import { CONVERTERS } from './converters'

/**
 * Per-token `align_form` derivation — LD's smart, fast-iterating romanization
 * layer (the aligner itself is dumb: it only accepts a-z + apostrophe; see
 * `.issues/auto-align-timings.md`). The dictionary's `align_config` names a
 * primary source; a token whose primary yields nothing cascades through the
 * remaining sources. Still-empty word tokens are coverage gaps (sent untimed).
 */

const NON_ALIGN_FORM_REGEX = /[^a-z']/g

/**
 * Distill any Latin-ish text to the MMS vocab (a-z + apostrophe): lowercase,
 * decompose + strip combining diacritics, normalize curly apostrophes, drop
 * the rest. Ported from tutor's `english_align_form`, generalized with NFD so
 * arbitrary precomposed Latin diacritics (ɛ́, ū, ç…) survive as base letters.
 */
export function ascii_distill(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '') // combining diacritical marks
    .replace(/[’ʼ]/g, '\'')
    .replace(NON_ALIGN_FORM_REGEX, '')
}

export interface AlignEntryLike {
  lexeme?: Record<string, string> | null
  phonetic?: string | null
}

type AlignSource = AlignConfig['primary']

function source_text({ source, token, entry }: {
  source: AlignSource
  token: SentenceToken
  entry: AlignEntryLike | undefined
}): string[] {
  if (source === 'token_text')
    return [token.form]
  if (source === 'phonetic')
    return entry?.phonetic ? [entry.phonetic] : []
  const orthography = source.slice('orthography:'.length)
  const value = entry?.lexeme?.[orthography]
  return value ? [value] : []
}

/**
 * Derive one token's align_form via the configured primary source, cascading
 * through the remaining sources (token text → configured/any lexeme value →
 * phonetic) when a source distills to nothing. Returns '' when every source
 * fails — a coverage gap.
 */
export function derive_align_form({ token, entry, config }: {
  token: SentenceToken
  entry: AlignEntryLike | undefined
  config: AlignConfig
}): string {
  const convert = config.converter ? CONVERTERS[config.converter] : undefined
  const candidates: string[] = [
    ...source_text({ source: config.primary, token, entry }),
    token.form,
    ...Object.values(entry?.lexeme ?? {}),
    ...(entry?.phonetic ? [entry.phonetic] : []),
  ]
  for (const candidate of candidates) {
    if (!candidate)
      continue
    const distilled = ascii_distill(convert ? convert(candidate) : candidate)
    if (distilled)
      return distilled
  }
  return ''
}

export interface AlignWord {
  text: string
  /** Omitted for punctuation + coverage gaps — the aligner leaves them untimed. */
  align_form?: string
}

export interface DerivedSentenceWords {
  sentence_id: string
  /** 1:1 with the sentence's default-orthography tokens. */
  words: AlignWord[]
}

export interface DeriveResult {
  sentences: DerivedSentenceWords[]
  /** Word (non-punctuation) tokens across all sentences. */
  tokens_total: number
  /** Word tokens that got an align_form. */
  tokens_aligned: number
  /** Distinct forms that derived nothing (coverage gaps), for reporting. */
  gap_forms: string[]
}

/** Derive align_forms for every token of every sentence, 1:1 with token order. */
export function derive_sentence_words({ sentences, entries_by_id, config }: {
  sentences: { sentence_id: string, tokens: SentenceToken[] }[]
  entries_by_id: Map<string, AlignEntryLike>
  config: AlignConfig
}): DeriveResult {
  const result: DerivedSentenceWords[] = []
  let tokens_total = 0
  let tokens_aligned = 0
  const gap_forms = new Set<string>()

  for (const { sentence_id, tokens } of sentences) {
    const words: AlignWord[] = tokens.map((token) => {
      if (is_punctuation_form(token.form))
        return { text: token.form }
      tokens_total++
      const entry = token.entry_id ? entries_by_id.get(token.entry_id) : undefined
      const align_form = derive_align_form({ token, entry, config })
      if (!align_form) {
        gap_forms.add(token.form)
        return { text: token.form }
      }
      tokens_aligned++
      return { text: token.form, align_form }
    })
    result.push({ sentence_id, words })
  }

  return { sentences: result, tokens_total, tokens_aligned, gap_forms: [...gap_forms] }
}

if (import.meta.vitest) {
  describe(ascii_distill, () => {
    test('lowercases and strips punctuation', () => {
      expect(ascii_distill('Hello, world!')).toBe('helloworld')
    })
    test('strips Latin diacritics via NFD (non-Latin base letters like ɛ/ʂ still drop)', () => {
      expect(ascii_distill('café')).toBe('cafe')
      expect(ascii_distill('Ūmū')).toBe('umu')
      expect(ascii_distill('wɛnʂán')).toBe('wnan')
    })
    test('normalizes curly apostrophes', () => {
      expect(ascii_distill('can’t')).toBe('can\'t')
    })
    test('non-Latin scripts distill to nothing', () => {
      expect(ascii_distill('文山话')).toBe('')
    })
  })

  describe(derive_align_form, () => {
    const config = { primary: 'token_text' } as AlignConfig
    test('primary token_text distills the surface form', () => {
      expect(derive_align_form({ token: { form: 'Kʼachi', start: 0, end: 6 }, entry: undefined, config })).toBe('k\'achi')
    })
    test('cascades to entry lexeme when token text is non-Latin', () => {
      const entry = { lexeme: { default: '文山', latin: 'wenshan' } }
      expect(derive_align_form({ token: { form: '文山', start: 0, end: 2, entry_id: 'e1' }, entry, config })).toBe('wenshan')
    })
    test('cascades to phonetic last', () => {
      const entry = { lexeme: { default: '文山' }, phonetic: 'wɛnʂan' }
      expect(derive_align_form({ token: { form: '文山', start: 0, end: 2, entry_id: 'e1' }, entry, config })).toBe('wnan')
    })
    test('orthography primary reads the configured lexeme key first', () => {
      const entry = { lexeme: { default: 'Xhosa-form', practical: 'kosa' } }
      expect(derive_align_form({
        token: { form: 'ignored-surface', start: 0, end: 5, entry_id: 'e1' },
        entry,
        config: { primary: 'orthography:practical' },
      })).toBe('kosa')
    })
    test('returns empty string when nothing derives', () => {
      expect(derive_align_form({ token: { form: '文山', start: 0, end: 2 }, entry: undefined, config })).toBe('')
    })
  })

  describe(derive_sentence_words, () => {
    test('punctuation untimed, gaps counted once per form', () => {
      const { sentences, tokens_total, tokens_aligned, gap_forms } = derive_sentence_words({
        sentences: [{
          sentence_id: 's1',
          tokens: [
            { form: 'Hello', start: 0, end: 5 },
            { form: ',', start: 5, end: 6, status: 'ignored' },
            { form: '文山', start: 7, end: 9 },
            { form: '文山', start: 10, end: 12 },
          ],
        }],
        entries_by_id: new Map(),
        config: { primary: 'token_text' },
      })
      expect(sentences[0].words).toEqual([
        { text: 'Hello', align_form: 'hello' },
        { text: ',' },
        { text: '文山' },
        { text: '文山' },
      ])
      expect(tokens_total).toBe(3)
      expect(tokens_aligned).toBe(1)
      expect(gap_forms).toEqual(['文山'])
    })
  })
}
