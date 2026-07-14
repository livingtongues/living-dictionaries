import type { MorphemeInput, SentenceIgtFields, SentenceTokenInput, SentenceTokensInput } from './entry-input'
import type { Morpheme, SentenceToken, SentenceTokens, SourceCitation } from '$lib/db/schemas/dictionary.types'
import type { DiscourseRole } from '$lib/constants'
import type { MultiString } from '$lib/types'
import { DISCOURSE_ROLES } from '$lib/constants'
import { to_multistring } from './entry-input'

/**
 * Interlinear-glossed-text (IGT) write helpers for the `/api/v1` sentence write
 * shapes. Turns forgiving agent input (per-orthography `{form, gloss}` rows,
 * offsets optional) into the stored `sentences.tokens` shape, plus the
 * `citations` / `discourse_role` normalizers. See .issues/structured-grammar.md.
 */

const MORPHEME_SEPARATORS = new Set(['-', '=', '~', '.'])

function build_morphemes(input: MorphemeInput[] | undefined): Morpheme[] | undefined {
  if (!Array.isArray(input) || !input.length)
    return undefined
  const out: Morpheme[] = []
  for (const raw of input) {
    const form = typeof raw?.form === 'string' ? raw.form : ''
    if (!form)
      continue
    const morpheme: Morpheme = { form }
    const gloss = to_multistring(raw.gloss)
    if (gloss) morpheme.gloss = gloss
    if (raw.entry_id) morpheme.entry_id = raw.entry_id
    if (raw.separator && MORPHEME_SEPARATORS.has(raw.separator)) morpheme.separator = raw.separator
    out.push(morpheme)
  }
  return out.length ? out : undefined
}

/**
 * Derive `start`/`end` char offsets for an ordered token list against `text`
 * with a LEFT-TO-RIGHT cursor that consumes each match in turn (a global search
 * would collide — ~28% of real sentences repeat a form). Explicit offsets on a
 * token are honored as-is. A form that can't be located (byte-mismatch, ~2.4%)
 * gets a zero-width span at the cursor so the array stays aligned rather than
 * blocking the whole sentence.
 */
function derive_tokens(text: string, input: SentenceTokenInput[]): SentenceToken[] {
  let cursor = 0
  return input.map((raw) => {
    const form = typeof raw?.form === 'string' ? raw.form : ''
    let start = typeof raw.start === 'number' ? raw.start : undefined
    let end = typeof raw.end === 'number' ? raw.end : undefined
    if (start === undefined || end === undefined) {
      const from_cursor = form ? text.indexOf(form, cursor) : -1
      const at = from_cursor >= 0 ? from_cursor : (form ? text.indexOf(form) : -1)
      if (at >= 0) {
        start = at
        end = at + form.length
      } else {
        start = cursor
        end = cursor
      }
    }
    cursor = Math.max(cursor, end)
    const token: SentenceToken = { form, start, end }
    const gloss = to_multistring(raw.gloss)
    if (gloss) token.gloss = gloss
    const morphemes = build_morphemes(raw.morphemes)
    if (morphemes) token.morphemes = morphemes
    if (raw.entry_id) token.entry_id = raw.entry_id
    if (raw.sense_id) token.sense_id = raw.sense_id
    token.status = raw.status ?? 'confirmed'
    return token
  })
}

/**
 * Resolve agent `tokens` into the stored `sentences.tokens` shape, deriving
 * offsets and — when the text for an orthography is missing — synthesizing it by
 * joining the token forms with a space (serves rows-only glossed sources). Returns
 * the (possibly augmented) text so the caller stores both consistently.
 */
export function resolve_sentence_igt({ tokens, text }: { tokens?: SentenceTokensInput, text?: MultiString }): { tokens?: SentenceTokens, text?: MultiString } {
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens))
    return { tokens: undefined, text }
  const built: SentenceTokens = {}
  const merged_text: MultiString = { ...(text ?? {}) }
  for (const [orthography, list] of Object.entries(tokens)) {
    if (!Array.isArray(list) || !list.length)
      continue
    let text_string = merged_text[orthography]
    if (!text_string) {
      text_string = list.map(token => (typeof token?.form === 'string' ? token.form.trim() : '')).filter(Boolean).join(' ')
      if (text_string) merged_text[orthography] = text_string
    }
    built[orthography] = derive_tokens(text_string ?? '', list)
  }
  return {
    tokens: Object.keys(built).length ? built : undefined,
    text: Object.keys(merged_text).length ? merged_text : undefined,
  }
}

/** Normalize `citations` input to the stored `SourceCitation[]` shape (drops
 *  slug-less entries). The slugs are validated against the source registry by
 *  the caller (same path as `sources`). */
export function to_citations(value: unknown): SourceCitation[] | undefined {
  if (!Array.isArray(value))
    return undefined
  const out: SourceCitation[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object')
      continue
    const slug = typeof (raw as SourceCitation).slug === 'string' ? (raw as SourceCitation).slug.trim() : ''
    if (!slug)
      continue
    const locator = typeof (raw as SourceCitation).locator === 'string' ? (raw as SourceCitation).locator.trim() : ''
    out.push(locator ? { slug, locator } : { slug })
  }
  return out.length ? out : undefined
}

/** Every source slug referenced by `citations` (for registry validation). */
export function citation_slugs(citations: SourceCitation[] | undefined): string[] {
  return citations ? citations.map(citation => citation.slug) : []
}

/** Validate + normalize a discourse role. `undefined` → untouched; `null`/`''` →
 *  clear; a valid enum member → itself; anything else throws. */
export function to_discourse_role(value: SentenceIgtFields['discourse_role']): DiscourseRole | null | undefined {
  if (value === undefined)
    return undefined
  if (value === null || value === '')
    return null
  if (typeof value === 'string' && (DISCOURSE_ROLES as readonly string[]).includes(value))
    return value as DiscourseRole
  throw new Error(`invalid discourse_role '${value}'; expected one of ${DISCOURSE_ROLES.join(', ')}`)
}

if (import.meta.vitest) {
  describe(resolve_sentence_igt, () => {
    it('derives offsets with a left-to-right cursor across a repeated form', () => {
      const { tokens } = resolve_sentence_igt({
        text: { default: 'na na bird' },
        tokens: { default: [{ form: 'na' }, { form: 'na' }, { form: 'bird', gloss: 'bird' }] },
      })
      expect(tokens?.default.map(t => [t.start, t.end])).toEqual([[0, 2], [3, 5], [6, 10]])
      expect(tokens?.default[2].gloss).toEqual({ default: 'bird' })
      expect(tokens?.default[0].status).toBe('confirmed')
    })

    it('synthesizes the text by joining forms when the orthography text is absent', () => {
      const { tokens, text } = resolve_sentence_igt({
        tokens: { default: [{ form: 'kaq' }, { form: 'sii', gloss: { en: 'dog' } }] },
      })
      expect(text).toEqual({ default: 'kaq sii' })
      expect(tokens?.default.map(t => [t.start, t.end])).toEqual([[0, 3], [4, 7]])
    })

    it('stores neutral category codes under `default` and keeps morpheme separators', () => {
      const { tokens } = resolve_sentence_igt({
        text: { default: 'ateb' },
        tokens: { default: [{ form: 'ateb', gloss: '3PL', morphemes: [{ form: 'at' }, { form: 'eb', gloss: '3PL', separator: '-' }] }] },
      })
      expect(tokens?.default[0].gloss).toEqual({ default: '3PL' })
      expect(tokens?.default[0].morphemes).toEqual([{ form: 'at' }, { form: 'eb', gloss: { default: '3PL' }, separator: '-' }])
    })

    it('places an unlocatable form at a zero-width cursor span instead of failing', () => {
      const { tokens } = resolve_sentence_igt({
        text: { default: 'abc' },
        tokens: { default: [{ form: 'abc' }, { form: 'zzz', gloss: 'ghost' }] },
      })
      expect(tokens?.default[1]).toMatchObject({ form: 'zzz', start: 3, end: 3, gloss: { default: 'ghost' } })
    })
  })

  describe(to_discourse_role, () => {
    it('passes a valid role, clears on null, throws on garbage', () => {
      expect(to_discourse_role('storyline')).toBe('storyline')
      expect(to_discourse_role(null)).toBeNull()
      expect(to_discourse_role(undefined)).toBeUndefined()
      expect(() => to_discourse_role('nonsense')).toThrow(/invalid discourse_role/)
    })
  })

  describe(to_citations, () => {
    it('normalizes and drops slug-less entries', () => {
      expect(to_citations([{ slug: 'smith-1981', locator: '1981:31' }, { locator: 'x' }, { slug: '  ' }])).toEqual([{ slug: 'smith-1981', locator: '1981:31' }])
      expect(to_citations([])).toBeUndefined()
      expect(to_citations('nope')).toBeUndefined()
    })
  })
}
