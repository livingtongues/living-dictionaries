import type { Orthography } from '$lib/db/schemas/shared.types'
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
}
