import type { GlobalRelationshipType } from '$lib/constants'
import { RELATIONSHIP_TYPES } from '$lib/constants'

/**
 * Pure canonicalization rules for `entry_relationships` rows, shared by the
 * server write path (`db/server/v1-relationship-write.ts`) and the browser
 * editing UI (`db/dict-client/operations.ts`) so both surfaces store identical
 * rows. See `.knowledge/domain/related-entries-model.md` for the reasoning.
 */

export interface RelationshipEndpoint {
  entry_id: string
  sense_id: string | null
}

// Separator for the endpoint sort-key used ONLY to canonicalize symmetric
// endpoint order (A↔B) before dedupe — never persisted. Written as the escaped
// `\0` (NUL), NOT a raw NUL byte: a raw NUL in the source makes git + ripgrep
// classify this whole file as binary (breaking grep/blame/diff navigability).
const ENDPOINT_KEY_SEPARATOR = '\0'

export function endpoint_key(entry_id: string, sense_id: string | null | undefined): string {
  return `${entry_id}${ENDPOINT_KEY_SEPARATOR}${sense_id ?? ''}`
}

/**
 * Resolve a GLOBAL slug to what gets stored: an inverse-alias member of a
 * directed pair (e.g. `hyponym`) resolves to its canonical partner
 * (`hypernym`) with `flip: true` so the caller swaps endpoints — every stored
 * row uses ONE slug per concept-pair.
 */
export function resolve_global_relationship_type(slug: GlobalRelationshipType): { type: string, symmetric: boolean, flip: boolean } {
  const global = RELATIONSHIP_TYPES[slug]
  const canonical = 'canonical' in global ? global.canonical : undefined
  return { type: canonical ?? slug, symmetric: global.symmetric, flip: !!canonical }
}

/**
 * Apply the endpoint ordering rules: an inverse-alias flip first, then the
 * symmetric sort (so A→B and B→A collapse to one stored order for dedupe).
 */
export function canonicalize_relationship_endpoints({ from, to, symmetric, flip }: {
  from: RelationshipEndpoint
  to: RelationshipEndpoint
  symmetric: boolean
  flip: boolean
}): { from: RelationshipEndpoint, to: RelationshipEndpoint } {
  if (flip)
    [from, to] = [to, from]
  if (symmetric && endpoint_key(from.entry_id, from.sense_id) > endpoint_key(to.entry_id, to.sense_id))
    [from, to] = [to, from]
  return { from, to }
}

if (import.meta.vitest) {
  describe(resolve_global_relationship_type, () => {
    it('keeps symmetric slugs as-is', () => {
      expect(resolve_global_relationship_type('synonym')).toEqual({ type: 'synonym', symmetric: true, flip: false })
    })

    it('keeps canonical directed slugs as-is', () => {
      expect(resolve_global_relationship_type('hypernym')).toEqual({ type: 'hypernym', symmetric: false, flip: false })
    })

    it('resolves inverse aliases to the canonical partner with flip', () => {
      expect(resolve_global_relationship_type('hyponym')).toEqual({ type: 'hypernym', symmetric: false, flip: true })
      expect(resolve_global_relationship_type('loaned_to')).toEqual({ type: 'borrowed_from', symmetric: false, flip: true })
    })
  })

  describe(canonicalize_relationship_endpoints, () => {
    const a = { entry_id: 'a', sense_id: null }
    const b = { entry_id: 'b', sense_id: null }

    it('flips endpoints for inverse aliases', () => {
      expect(canonicalize_relationship_endpoints({ from: a, to: b, symmetric: false, flip: true })).toEqual({ from: b, to: a })
    })

    it('sorts symmetric endpoints so A→B and B→A collapse', () => {
      expect(canonicalize_relationship_endpoints({ from: b, to: a, symmetric: true, flip: false })).toEqual({ from: a, to: b })
      expect(canonicalize_relationship_endpoints({ from: a, to: b, symmetric: true, flip: false })).toEqual({ from: a, to: b })
    })

    it('sense ids participate in the symmetric sort', () => {
      const a1 = { entry_id: 'a', sense_id: 's1' }
      const a2 = { entry_id: 'a', sense_id: 's2' }
      expect(canonicalize_relationship_endpoints({ from: a2, to: a1, symmetric: true, flip: false })).toEqual({ from: a1, to: a2 })
    })

    it('leaves directed canonical endpoints untouched', () => {
      expect(canonicalize_relationship_endpoints({ from: b, to: a, symmetric: false, flip: false })).toEqual({ from: b, to: a })
    })
  })
}
