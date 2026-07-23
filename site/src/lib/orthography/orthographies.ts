import type { Orthography } from '$lib/db/schemas/shared.types'
import type { MultiString } from '$lib/types'
import { PRIMARY_ORTHOGRAPHY_CODE } from '$lib/db/schemas/shared.types'

export interface DerivedOrthographies {
  /** The pinned canonical headword (code `'default'`), synthesized if not configured. */
  primary: Orthography
  /** Alternate orthographies in registry order (everything but the primary). */
  alternates: Orthography[]
  /** `[primary, ...alternates]` — the full ordered list to render. */
  all: Orthography[]
}

/**
 * Normalize a dictionary's stored `orthographies` into a primary + alternates
 * view. The primary (`code: 'default'`) is always present: taken from the array
 * if configured, otherwise synthesized so the `lexeme.default` accessor always
 * resolves. Alternates keep their stored order.
 */
export function get_orthographies(
  { orthographies }: { orthographies?: Orthography[] | null },
): DerivedOrthographies {
  const list = orthographies ?? []
  const explicit_primary = list.find(orthography => orthography.code === PRIMARY_ORTHOGRAPHY_CODE)
  const primary: Orthography = explicit_primary
    ? { ...explicit_primary, primary: true }
    : { code: PRIMARY_ORTHOGRAPHY_CODE, name: '', primary: true }
  const alternates = list.filter(orthography => orthography.code !== PRIMARY_ORTHOGRAPHY_CODE)
  return { primary, alternates, all: [primary, ...alternates] }
}

export interface Headword {
  value: string
  /** Orthography code the value came from — `'default'` unless promoted from an alternate. */
  code: string
}

/**
 * The DISPLAY headword for an entry: `lexeme.default` when populated, otherwise the
 * first populated alternate orthography in registry order (real case: a multi-dialect
 * dictionary where one dialect's entries are written only in an alternate orthography).
 * Editing surfaces keep reading/writing `lexeme.default` directly so editors can see
 * it's genuinely unset. Surfaces that also list the alternates should skip the
 * returned `code` to avoid rendering the promoted form twice.
 */
export function get_headword({ lexeme, orthographies }: {
  lexeme: MultiString | null | undefined
  orthographies?: Orthography[] | null
}): Headword {
  const default_value = lexeme?.[PRIMARY_ORTHOGRAPHY_CODE]
  if (default_value) return { value: default_value, code: PRIMARY_ORTHOGRAPHY_CODE }
  for (const { code } of get_orthographies({ orthographies }).alternates) {
    const value = lexeme?.[code]
    if (value) return { value, code }
  }
  return { value: '', code: PRIMARY_ORTHOGRAPHY_CODE }
}

if (import.meta.vitest) {
  describe(get_orthographies, () => {
    test('synthesizes a primary for a dict with no orthographies', () => {
      expect(get_orthographies({ orthographies: null })).toEqual({
        primary: { code: 'default', name: '', primary: true },
        alternates: [],
        all: [{ code: 'default', name: '', primary: true }],
      })
    })

    test('keeps alternates in order and synthesizes primary when absent', () => {
      const { primary, alternates, all } = get_orthographies({
        orthographies: [
          { code: 'sat-Latn', name: 'Latin', bcp: 'sat-Latn' },
          { code: 'sat-Olck', name: 'Ol Chiki', bcp: 'sat-Olck' },
        ],
      })
      expect(primary.code).toBe('default')
      expect(alternates.map(orthography => orthography.code)).toEqual(['sat-Latn', 'sat-Olck'])
      expect(all.map(orthography => orthography.code)).toEqual(['default', 'sat-Latn', 'sat-Olck'])
    })

    test('uses an explicit primary and pins it first regardless of stored position', () => {
      const { primary, all } = get_orthographies({
        orthographies: [
          { code: 'sat-Olck', name: 'Ol Chiki', bcp: 'sat-Olck' },
          { code: 'default', name: 'Latin', bcp: 'sat-Latn', primary: true },
        ],
      })
      expect(primary).toEqual({ code: 'default', name: 'Latin', bcp: 'sat-Latn', primary: true })
      expect(all.map(orthography => orthography.code)).toEqual(['default', 'sat-Olck'])
    })
  })

  describe(get_headword, () => {
    const orthographies: Orthography[] = [
      { code: 'default', name: 'Latin', primary: true },
      { code: 'sat-Olck', name: 'Ol Chiki', bcp: 'sat-Olck' },
      { code: 'sat-Deva', name: 'Devanagari', bcp: 'sat-Deva' },
    ]

    test('uses default when populated', () => {
      expect(get_headword({ lexeme: { 'default': 'foo', 'sat-Olck': 'ᱯᱚ' }, orthographies }))
        .toEqual({ value: 'foo', code: 'default' })
    })

    test('falls back to first POPULATED alternate in registry order', () => {
      expect(get_headword({ lexeme: { 'sat-Deva': 'फो' }, orthographies }))
        .toEqual({ value: 'फो', code: 'sat-Deva' })
      expect(get_headword({ lexeme: { 'sat-Olck': 'ᱯᱚ', 'sat-Deva': 'फो' }, orthographies }))
        .toEqual({ value: 'ᱯᱚ', code: 'sat-Olck' })
    })

    test('empty-string default falls through to an alternate', () => {
      expect(get_headword({ lexeme: { 'default': '', 'sat-Olck': 'ᱯᱚ' }, orthographies }))
        .toEqual({ value: 'ᱯᱚ', code: 'sat-Olck' })
    })

    test('ignores lexeme keys not in the registry', () => {
      expect(get_headword({ lexeme: { stray: 'bar' }, orthographies }))
        .toEqual({ value: '', code: 'default' })
    })

    test('empty value when nothing is populated', () => {
      expect(get_headword({ lexeme: null, orthographies })).toEqual({ value: '', code: 'default' })
      expect(get_headword({ lexeme: {}, orthographies: null })).toEqual({ value: '', code: 'default' })
    })
  })
}
