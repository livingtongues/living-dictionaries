import type { SentenceTokens } from '$lib/db/schemas/dictionary.types'
import { is_punctuation_form, normalized_word_key } from './tokenize-sentence'

/**
 * The suggestions-queue aggregation (.issues/texts-sentences-pipeline.md M4):
 * one pure pass over tokenized sentences groups word tokens by normalized form
 * into three facets — unmatched (no link at all), ambiguous (multi-candidate),
 * ignored (occurrence ignores + the dictionary-level `ignored_forms` list).
 * Shared verbatim by the client worker (queue page + side-menu pill) and the
 * server (v1 GET suggestions), so both surfaces always agree.
 */

export interface SuggestionOccurrence {
  sentence_id: string
  text_id: string | null
  orthography: string
  token_index: number
  start: number
  end: number
}

export interface SuggestionRow {
  /** Normalized word key (grouping identity, matches `ignored_forms.form`). */
  key: string
  /** Most frequent surface form — what the queue displays. */
  display_form: string
  /** Total occurrences across all sentences. */
  count: number
  sentence_count: number
  occurrences: SuggestionOccurrence[]
  /** Ambiguous facet: union of candidate entry ids. */
  candidates?: string[]
  /** Ignored facet: true when the form is in the dictionary-level ignore list. */
  everywhere?: boolean
}

export interface SuggestionFacets {
  unmatched: SuggestionRow[]
  ambiguous: SuggestionRow[]
  ignored: SuggestionRow[]
}

interface SentenceForAggregation {
  id: string
  text_id?: string | null
  tokens?: SentenceTokens | null
}

export function aggregate_suggestions({ sentences, ignored_forms = new Set() }: {
  sentences: SentenceForAggregation[]
  /** Normalized keys from the `ignored_forms` table. */
  ignored_forms?: Set<string>
}): SuggestionFacets {
  const unmatched = new Map<string, SuggestionRow>()
  const ambiguous = new Map<string, SuggestionRow>()
  const ignored = new Map<string, SuggestionRow>()
  const form_tallies = new Map<string, Map<string, number>>()

  function add({ bucket, key, token_form, occurrence, candidates }: {
    bucket: Map<string, SuggestionRow>
    key: string
    token_form: string
    occurrence: SuggestionOccurrence
    candidates?: string[]
  }) {
    let row = bucket.get(key)
    if (!row) {
      row = { key, display_form: token_form, count: 0, sentence_count: 0, occurrences: [] }
      bucket.set(key, row)
    }
    row.count++
    row.occurrences.push(occurrence)
    for (const candidate of candidates ?? []) {
      row.candidates ??= []
      if (!row.candidates.includes(candidate))
        row.candidates.push(candidate)
    }
    let tally = form_tallies.get(key)
    if (!tally) {
      tally = new Map()
      form_tallies.set(key, tally)
    }
    const seen = (tally.get(token_form) ?? 0) + 1
    tally.set(token_form, seen)
    if (seen > (tally.get(row.display_form) ?? 0))
      row.display_form = token_form
  }

  for (const sentence of sentences) {
    for (const [orthography, list] of Object.entries(sentence.tokens ?? {})) {
      for (const [token_index, token] of list.entries()) {
        if (is_punctuation_form(token.form))
          continue
        const key = normalized_word_key(token.form)
        if (!key)
          continue
        const occurrence: SuggestionOccurrence = {
          sentence_id: sentence.id,
          text_id: sentence.text_id ?? null,
          orthography,
          token_index,
          start: token.start,
          end: token.end,
        }
        if (token.candidates?.length && !token.entry_id && token.status !== 'ignored')
          add({ bucket: ambiguous, key, token_form: token.form, occurrence, candidates: token.candidates })
        else if (token.status === 'ignored')
          add({ bucket: ignored, key, token_form: token.form, occurrence })
        else if (!token.entry_id && !token.sense_id && !token.status)
          add({ bucket: unmatched, key, token_form: token.form, occurrence })
      }
    }
  }

  // Dictionary-level ignores with no current occurrences still show (so they
  // can be reviewed/restored), and every occurrence row gets its flag.
  for (const key of ignored_forms) {
    let row = ignored.get(key)
    if (!row) {
      row = { key, display_form: key, count: 0, sentence_count: 0, occurrences: [] }
      ignored.set(key, row)
    }
    row.everywhere = true
  }

  return {
    unmatched: finalize(unmatched),
    ambiguous: finalize(ambiguous),
    ignored: finalize(ignored),
  }
}

/** Distinct unmatched form count only — the cheap path for the side-menu pill. */
export function count_unmatched_forms(sentences: SentenceForAggregation[]): number {
  const keys = new Set<string>()
  for (const sentence of sentences) {
    for (const list of Object.values(sentence.tokens ?? {})) {
      for (const token of list) {
        if (token.entry_id || token.sense_id || token.status || token.candidates?.length)
          continue
        if (is_punctuation_form(token.form))
          continue
        const key = normalized_word_key(token.form)
        if (key)
          keys.add(key)
      }
    }
  }
  return keys.size
}

function finalize(bucket: Map<string, SuggestionRow>): SuggestionRow[] {
  const rows = [...bucket.values()]
  for (const row of rows)
    row.sentence_count = new Set(row.occurrences.map(occurrence => occurrence.sentence_id)).size
  return rows.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

if (import.meta.vitest) {
  describe(aggregate_suggestions, () => {
    const sentences: SentenceForAggregation[] = [
      {
        id: 'sen1',
        text_id: 't1',
        tokens: {
          default: [
            { form: 'Ri', start: 0, end: 2 },
            { form: 'achi', start: 3, end: 7, entry_id: 'e1', status: 'auto' },
            { form: 'kaq', start: 8, end: 11, candidates: ['e2', 'e3'] },
            { form: ',', start: 11, end: 12, status: 'ignored' },
            { form: 'zzz', start: 13, end: 16, status: 'ignored' },
          ],
        },
      },
      {
        id: 'sen2',
        text_id: null,
        tokens: {
          default: [
            { form: 'ri', start: 0, end: 2 },
            { form: 'ri', start: 3, end: 5 },
            { form: 'kaq', start: 6, end: 9, candidates: ['e2', 'e4'] },
            { form: 'wow', start: 10, end: 13, entry_id: 'e5', sense_id: 's5', status: 'confirmed' },
          ],
        },
      },
    ]

    test('groups by normalized key across sentences with frequency sort + majority display form', () => {
      const { unmatched } = aggregate_suggestions({ sentences })
      expect(unmatched).toHaveLength(1)
      const [row] = unmatched
      expect(row.key).toBe('ri')
      expect(row.display_form).toBe('ri')
      expect(row.count).toBe(3)
      expect(row.sentence_count).toBe(2)
      expect(row.occurrences[0]).toEqual({ sentence_id: 'sen1', text_id: 't1', orthography: 'default', token_index: 0, start: 0, end: 2 })
    })

    test('ambiguous facet unions candidates; linked/confirmed/punctuation stay out of every facet', () => {
      const { ambiguous, unmatched, ignored } = aggregate_suggestions({ sentences })
      expect(ambiguous).toHaveLength(1)
      expect(ambiguous[0].key).toBe('kaq')
      expect(ambiguous[0].count).toBe(2)
      expect(ambiguous[0].candidates).toEqual(['e2', 'e3', 'e4'])
      const all_keys = [...unmatched, ...ambiguous, ...ignored].map(row => row.key)
      expect(all_keys.includes('achi')).toBe(false)
      expect(all_keys.includes('wow')).toBe(false)
      expect(all_keys.includes(',')).toBe(false)
    })

    test('ignored facet: word occurrences + zero-count dictionary-level forms, flagged', () => {
      const { ignored } = aggregate_suggestions({ sentences, ignored_forms: new Set(['zzz', 'gone']) })
      expect(ignored.map(row => [row.key, row.count, row.everywhere ?? false])).toEqual([
        ['zzz', 1, true],
        ['gone', 0, true],
      ])
    })

    test('empty input yields empty facets', () => {
      expect(aggregate_suggestions({ sentences: [] })).toEqual({ unmatched: [], ambiguous: [], ignored: [] })
    })

    test('count_unmatched_forms matches the unmatched facet length', () => {
      expect(count_unmatched_forms(sentences)).toBe(aggregate_suggestions({ sentences }).unmatched.length)
      expect(count_unmatched_forms([])).toBe(0)
    })
  })
}
