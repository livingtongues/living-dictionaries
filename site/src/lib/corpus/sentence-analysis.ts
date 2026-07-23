import type { MultiString } from '$lib/types'
import type { SentenceToken, SentenceTokens } from '$lib/db/schemas/dictionary.types'
import type { LexemeIndex } from './match-tokens'
import { build_lexeme_index, match_tokens } from './match-tokens'
import { carry_over_tokens } from './carry-over-tokens'
import { pick_tokenization_orthography, tokenize_sentence_text } from './tokenize-sentence'

/**
 * Connection-level analysis helpers shared by the leader-worker write
 * orchestrators (`dict-writes.ts`). Pure pipeline: tokenize → carry-over
 * (preserve confirmed/gold-IGT metadata by normalized form) → match (fill
 * blanks only). `analyze_sentence_tokens` is idempotent — unchanged sentences
 * return `changed: false` so re-analyze never causes dirty-row churn.
 */

interface QueryableConnection {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
}

export async function load_lexeme_index(connection: QueryableConnection): Promise<LexemeIndex> {
  const rows = await connection.query<{ id: string, lexeme: string | null }>(
    `SELECT id, lexeme FROM entries WHERE lexeme IS NOT NULL`,
  )
  const entries = rows.map(row => ({
    id: row.id,
    lexeme: parse_json_column<MultiString>(row.lexeme),
  }))
  return build_lexeme_index(entries)
}

export function parse_json_column<T>(value: unknown): T | null {
  if (value == null)
    return null
  if (typeof value !== 'string')
    return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

/** Canonical deep equality (key order independent) — guards against dirty-row
 *  churn when re-analysis reproduces the stored tokens. */
export function tokens_equal(a: unknown, b: unknown): boolean {
  return canonical_json(a) === canonical_json(b)
}

function canonical_json(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(canonical_json).join(',')}]`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort()
    return `{${keys.map(key => `${JSON.stringify(key)}:${canonical_json((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export interface SentenceAnalysis {
  changed: boolean
  /** Full tokens value to store (existing orthographies preserved). */
  tokens: SentenceTokens | null
  /** Senses whose token link vanished (junction cleanup for text sentences). */
  dropped_sense_ids: string[]
}

/**
 * Compute the next `tokens` value for one sentence: tokenizes the display
 * orthography (`default`, else first populated), carries existing metadata
 * over, fills blanks from the lexeme index. Other orthographies' token lists
 * are preserved untouched.
 */
export function analyze_sentence_tokens({ text, existing_tokens, index }: {
  text: MultiString | null
  existing_tokens: SentenceTokens | null
  index: LexemeIndex
}): SentenceAnalysis {
  const orthography = pick_tokenization_orthography(text)
  if (!orthography)
    return { changed: false, tokens: existing_tokens, dropped_sense_ids: [] }
  const text_string = text?.[orthography] ?? ''
  const fresh = tokenize_sentence_text(text_string)
  const previous = existing_tokens?.[orthography] ?? []
  const { tokens: carried, dropped_sense_ids } = carry_over_tokens({ previous, next: fresh, text: text_string })
  const matched = match_tokens({ tokens: carried, text: text_string, index })
  if (tokens_equal(previous, matched))
    return { changed: false, tokens: existing_tokens, dropped_sense_ids: [] }
  return {
    changed: true,
    tokens: { ...(existing_tokens ?? {}), [orthography]: matched },
    dropped_sense_ids,
  }
}

/** True when any token (any orthography) still references the sense. */
export function tokens_reference_sense({ tokens, sense_id }: {
  tokens: SentenceTokens | null
  sense_id: string
}): boolean {
  for (const list of Object.values(tokens ?? {})) {
    if (list.some(token => token.sense_id === sense_id))
      return true
  }
  return false
}

if (import.meta.vitest) {
  describe(analyze_sentence_tokens, () => {
    const index = build_lexeme_index([
      { id: 'e1', lexeme: { default: 'nak' } },
      { id: 'e2', lexeme: { default: 'tore' } },
    ])

    test('fresh sentence gets tokenized + auto-matched', () => {
      const { changed, tokens } = analyze_sentence_tokens({
        text: { default: 'Nak zzz.' },
        existing_tokens: null,
        index,
      })
      expect(changed).toBe(true)
      expect(tokens?.default).toEqual([
        { form: 'Nak', start: 0, end: 3, entry_id: 'e1', status: 'auto' },
        { form: 'zzz', start: 4, end: 7 },
        { form: '.', start: 7, end: 8, status: 'ignored' },
      ])
    })

    test('gold tokens that fully cover the text are untouched (changed: false)', () => {
      const gold: SentenceToken[] = [
        { form: 'Nak', start: 0, end: 3, gloss: { en: 'water' }, status: 'confirmed' },
        { form: 'zzz', start: 4, end: 7, gloss: { default: '3PL' } },
        { form: '.', start: 7, end: 8, status: 'ignored' },
      ]
      const existing = { default: gold }
      const result = analyze_sentence_tokens({ text: { default: 'Nak zzz.' }, existing_tokens: existing, index })
      expect(result.changed).toBe(false)
      expect(result.tokens).toBe(existing)
    })

    test('alternate-orthography sentences tokenize under their populated code', () => {
      const { tokens } = analyze_sentence_tokens({
        text: { 'sat-Olck': 'ᱯᱚ' },
        existing_tokens: null,
        index,
      })
      expect(tokens?.['sat-Olck']).toEqual([{ form: 'ᱯᱚ', start: 0, end: 2 }])
    })

    test('empty text is a no-op', () => {
      expect(analyze_sentence_tokens({ text: null, existing_tokens: null, index }))
        .toEqual({ changed: false, tokens: null, dropped_sense_ids: [] })
    })
  })

  describe(tokens_reference_sense, () => {
    test('scans all orthographies', () => {
      const tokens = {
        default: [{ form: 'a', start: 0, end: 1 }],
        alt: [{ form: 'b', start: 0, end: 1, sense_id: 's1' }],
      }
      expect(tokens_reference_sense({ tokens, sense_id: 's1' })).toBe(true)
      expect(tokens_reference_sense({ tokens, sense_id: 's2' })).toBe(false)
      expect(tokens_reference_sense({ tokens: null, sense_id: 's1' })).toBe(false)
    })
  })

  describe(tokens_equal, () => {
    test('key order independent', () => {
      expect(tokens_equal(
        [{ form: 'a', start: 0, end: 1, status: 'auto', entry_id: 'e' }],
        [{ entry_id: 'e', status: 'auto', end: 1, start: 0, form: 'a' }],
      )).toBe(true)
      expect(tokens_equal([{ form: 'a' }], [{ form: 'b' }])).toBe(false)
    })
  })
}
