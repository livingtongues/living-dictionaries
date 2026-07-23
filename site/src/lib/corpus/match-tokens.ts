import type { MultiString } from '$lib/types'
import type { SentenceToken } from '$lib/db/schemas/dictionary.types'
import { normalized_word_key, word_count } from './tokenize-sentence'

/**
 * Matcher v1 (.issues/texts-sentences-pipeline.md M3): exact match of
 * normalized token forms against all normalized lexeme forms (all
 * orthographies). Single hit → `entry_id` + `status:'auto'`; multiple hits →
 * `candidates`; none → unmatched. Multi-word lexemes match greedily
 * (longest-first) over consecutive word tokens, merging them into ONE token
 * spanning the phrase.
 *
 * The matcher only FILLS blank tokens — it never touches a token that already
 * carries a link, candidates, a status (confirmed/ignored/punctuation), or
 * gold IGT metadata (gloss/morphemes).
 */

export interface LexemeIndex {
  /** normalized word key (space-joined) → entry ids that share the form */
  by_form: Map<string, string[]>
  /** longest lexeme in words — bounds the n-gram search */
  max_word_count: number
}

export function build_lexeme_index(entries: { id: string, lexeme: MultiString | null }[]): LexemeIndex {
  const by_form = new Map<string, string[]>()
  let max_word_count = 1
  for (const entry of entries) {
    const seen_keys = new Set<string>()
    for (const value of Object.values(entry.lexeme ?? {})) {
      if (!value?.trim())
        continue
      const key = normalized_word_key(value)
      if (!key || seen_keys.has(key))
        continue
      seen_keys.add(key)
      const words = word_count(value)
      if (words > max_word_count)
        max_word_count = words
      const ids = by_form.get(key)
      if (ids) {
        if (!ids.includes(entry.id))
          ids.push(entry.id)
      } else {
        by_form.set(key, [entry.id])
      }
    }
  }
  return { by_form, max_word_count }
}

function is_fillable(token: SentenceToken): boolean {
  return !token.status && !token.entry_id && !token.sense_id
    && !token.candidates && !token.gloss && !token.morphemes
}

/** Fill unmatched word tokens from the lexeme index. Returns a NEW array
 *  (input tokens are not mutated); phrase matches merge consecutive tokens.
 *  A form in `ignored_forms` (the dictionary-level ignore list, normalized
 *  keys) is emitted `status:'ignored'` — but only when nothing matches, so
 *  creating an entry for a previously-ignored form resumes matching. */
export function match_tokens({ tokens, text, index, ignored_forms }: {
  tokens: SentenceToken[]
  /** The orthography's sentence text — merged phrase forms are sliced from it. */
  text: string
  index: LexemeIndex
  ignored_forms?: Set<string>
}): SentenceToken[] {
  const result: SentenceToken[] = []
  let position = 0
  while (position < tokens.length) {
    const token = tokens[position]
    if (!is_fillable(token)) {
      result.push(token)
      position++
      continue
    }
    let matched = false
    const max_n = Math.min(index.max_word_count, tokens.length - position)
    for (let n = max_n; n >= 1; n--) {
      const slice = tokens.slice(position, position + n)
      if (slice.some(candidate => !is_fillable(candidate)))
        continue
      const key = slice.map(candidate => normalized_word_key(candidate.form)).filter(Boolean).join(' ')
      if (!key)
        break
      const entry_ids = index.by_form.get(key)
      if (!entry_ids?.length)
        continue
      const [{ start }] = slice
      const { end } = slice[slice.length - 1]
      const form = n === 1 ? token.form : text.slice(start, end)
      if (entry_ids.length === 1)
        result.push({ form, start, end, entry_id: entry_ids[0], status: 'auto' })
      else
        result.push({ form, start, end, candidates: [...entry_ids] })
      position += n
      matched = true
      break
    }
    if (!matched) {
      const key = normalized_word_key(token.form)
      if (key && ignored_forms?.has(key))
        result.push({ form: token.form, start: token.start, end: token.end, status: 'ignored' })
      else
        result.push(token)
      position++
    }
  }
  return result
}

if (import.meta.vitest) {
  const entries = [
    { id: 'e1', lexeme: { default: 'nak' } },
    { id: 'e2', lexeme: { default: 'Toré' } },
    { id: 'e3', lexeme: { default: 'nak tore' } },
    { id: 'e4', lexeme: { 'default': 'kaq', 'alt-orth': 'qaq' } },
    { id: 'e5', lexeme: { default: 'kaq' } },
  ]

  describe(build_lexeme_index, () => {
    test('indexes normalized forms across orthographies with homograph lists', () => {
      const index = build_lexeme_index(entries)
      expect(index.by_form.get('nak')).toEqual(['e1'])
      expect(index.by_form.get('tore')).toEqual(['e2'])
      expect(index.by_form.get('nak tore')).toEqual(['e3'])
      expect(index.by_form.get('kaq')).toEqual(['e4', 'e5'])
      expect(index.by_form.get('qaq')).toEqual(['e4'])
      expect(index.max_word_count).toBe(2)
    })
  })

  describe(match_tokens, () => {
    const index = build_lexeme_index(entries)

    test('greedy longest match merges the phrase over the single words', () => {
      const text = 'Nak toré kaq'
      const tokens = [
        { form: 'Nak', start: 0, end: 3 },
        { form: 'toré', start: 4, end: 8 },
        { form: 'kaq', start: 9, end: 12 },
      ]
      expect(match_tokens({ tokens, text, index })).toEqual([
        { form: 'Nak toré', start: 0, end: 8, entry_id: 'e3', status: 'auto' },
        { form: 'kaq', start: 9, end: 12, candidates: ['e4', 'e5'] },
      ])
    })

    test('punctuation between words blocks a phrase match', () => {
      const text = 'Nak, toré'
      const tokens = [
        { form: 'Nak', start: 0, end: 3 },
        { form: ',', start: 3, end: 4, status: 'ignored' as const },
        { form: 'toré', start: 5, end: 9 },
      ]
      expect(match_tokens({ tokens, text, index })).toEqual([
        { form: 'Nak', start: 0, end: 3, entry_id: 'e1', status: 'auto' },
        { form: ',', start: 3, end: 4, status: 'ignored' },
        { form: 'toré', start: 5, end: 9, entry_id: 'e2', status: 'auto' },
      ])
    })

    test('never touches confirmed/ignored/glossed tokens (gold IGT preservation)', () => {
      const text = 'nak tore'
      const gold = [
        { form: 'nak', start: 0, end: 3, gloss: { en: 'water' }, status: 'confirmed' as const },
        { form: 'tore', start: 4, end: 8, gloss: { default: '3PL' } },
      ]
      expect(match_tokens({ tokens: gold, text, index })).toEqual(gold)
    })

    test('unmatched words pass through untouched', () => {
      const text = 'zzz'
      const tokens = [{ form: 'zzz', start: 0, end: 3 }]
      expect(match_tokens({ tokens, text, index })).toEqual(tokens)
    })

    test('dictionary-level ignored forms come out ignored, but a lexeme match wins over the ignore list', () => {
      const text = 'Ri nak zzz'
      const tokens = [
        { form: 'Ri', start: 0, end: 2 },
        { form: 'nak', start: 3, end: 6 },
        { form: 'zzz', start: 7, end: 10 },
      ]
      const ignored_forms = new Set(['ri', 'nak', 'zzz'])
      expect(match_tokens({ tokens, text, index, ignored_forms })).toEqual([
        { form: 'Ri', start: 0, end: 2, status: 'ignored' },
        { form: 'nak', start: 3, end: 6, entry_id: 'e1', status: 'auto' },
        { form: 'zzz', start: 7, end: 10, status: 'ignored' },
      ])
    })
  })
}
