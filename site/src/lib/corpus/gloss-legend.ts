import type { MultiString } from '$lib/types'

/**
 * The glossing-abbreviations legend: turning a raw gloss cell like `eat PFV` or
 * `1SG>2SG` into renderable pieces, where any code the dictionary has registered
 * in `glossing_abbreviations` becomes small-caps + tap-to-expand.
 *
 * Matching is deliberately a SUBSTRING match anywhere in the cell (the rule the
 * schema and the corpus guide both promise), so portmanteaux and mixed cells
 * light up without needing a per-token "is this grammatical?" flag. Longest code
 * first, so `1SG>2SG` wins over the `1SG` nested inside it, and matching is
 * CASE-SENSITIVE — Leipzig codes are upper-case, which is exactly what keeps
 * `DU` from firing inside the lexical gloss `dust`.
 */

export interface LegendEntry {
  code: string
  name: MultiString
  category?: string | null
}

export interface GlossPiece {
  text: string
  /** The legend code this piece IS, when it matched one. */
  code?: string
}

function escape_regex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build a splitter for one dictionary's legend. Returns a function so the
 * (single) regex is compiled once per legend rather than per gloss cell — an
 * interlinear text can hold thousands of cells.
 */
export function build_gloss_splitter(codes: readonly string[]): (gloss: string) => GlossPiece[] {
  const usable = [...new Set(codes.filter(code => code?.trim()))]
    .sort((first, second) => second.length - first.length)
  if (!usable.length)
    return gloss => (gloss ? [{ text: gloss }] : [])

  const pattern = new RegExp(`(${usable.map(escape_regex).join('|')})`, 'g')

  return (gloss: string): GlossPiece[] => {
    if (!gloss)
      return []
    const pieces: GlossPiece[] = []
    let cursor = 0
    pattern.lastIndex = 0
    let match = pattern.exec(gloss)
    while (match) {
      if (match.index > cursor)
        pieces.push({ text: gloss.slice(cursor, match.index) })
      pieces.push({ text: match[0], code: match[0] })
      cursor = match.index + match[0].length
      match = pattern.exec(gloss)
    }
    if (cursor < gloss.length)
      pieces.push({ text: gloss.slice(cursor) })
    return pieces
  }
}

/**
 * Read a gloss for the reader's language. Per the locked convention, a
 * language-neutral category code lives under the reserved `default` key, so a
 * per-language lexical gloss wins when present and the neutral code survives
 * every gloss-language switch.
 */
export function gloss_for_language(gloss: MultiString | null | undefined, language: string | null | undefined): string {
  if (!gloss)
    return ''
  if (language && gloss[language]?.trim())
    return gloss[language]
  return gloss.default?.trim() ? gloss.default : (Object.values(gloss).find(value => value?.trim()) ?? '')
}

/** Expansion of a legend code for the reader's language, falling back to any value. */
export function legend_expansion({ entry, language }: { entry: LegendEntry | undefined, language: string | null | undefined }): string {
  if (!entry)
    return ''
  return gloss_for_language(entry.name, language)
}

if (import.meta.vitest) {
  describe(build_gloss_splitter, () => {
    test('splits a mixed cell into lexical text and legend codes', () => {
      const split = build_gloss_splitter(['PFV', '3PL'])
      expect(split('eat PFV')).toEqual([{ text: 'eat ' }, { text: 'PFV', code: 'PFV' }])
      expect(split('3PL')).toEqual([{ text: '3PL', code: '3PL' }])
    })

    test('longest code wins over a code nested inside it', () => {
      const split = build_gloss_splitter(['1SG', '2SG', '1SG>2SG'])
      expect(split('1SG>2SG')).toEqual([{ text: '1SG>2SG', code: '1SG>2SG' }])
    })

    test('is case-sensitive, so an upper-case code never fires inside a lexical gloss', () => {
      const split = build_gloss_splitter(['DU'])
      expect(split('dust')).toEqual([{ text: 'dust' }])
      expect(split('DU')).toEqual([{ text: 'DU', code: 'DU' }])
    })

    test('handles regex-special characters in a code', () => {
      const split = build_gloss_splitter(['A.B', 'C+D'])
      expect(split('xA.By')).toEqual([{ text: 'x' }, { text: 'A.B', code: 'A.B' }, { text: 'y' }])
      expect(split('AxB')).toEqual([{ text: 'AxB' }])
    })

    test('an empty legend passes the gloss through untouched', () => {
      expect(build_gloss_splitter([])('anything')).toEqual([{ text: 'anything' }])
      expect(build_gloss_splitter([])('')).toEqual([])
    })
  })

  describe(gloss_for_language, () => {
    test('prefers the reader language, then the neutral default key', () => {
      expect(gloss_for_language({ en: 'dog', default: 'N' }, 'en')).toBe('dog')
      expect(gloss_for_language({ default: '3PL' }, 'en')).toBe('3PL')
      expect(gloss_for_language({ es: 'perro' }, 'en')).toBe('perro')
      expect(gloss_for_language(null, 'en')).toBe('')
    })
  })
}
