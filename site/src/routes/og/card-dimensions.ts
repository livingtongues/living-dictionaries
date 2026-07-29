/**
 * The share card's size, and the ceiling on what a URL may ask for.
 *
 * WHY (2026-07-29): `/og` took `width`/`height` straight out of the (anyone-can-
 * write-it) `?props=` payload and handed them to satori + resvg. A single
 * `{"width":20000,"height":20000}` therefore asks a 2-core box to allocate
 * ~1.6 GB for one crawler request — the 2026-07-27/28 work bounded how OFTEN
 * this server draws a card, never how BIG one drawing may be. House solves it by
 * ignoring requested dimensions entirely; LD keeps them adjustable but capped,
 * since `SeoMetaTags` exposes `width`/`height` props.
 *
 * The clamp is invisible in practice: no caller passes anything but the
 * defaults, so only a hand-written URL ever sees it.
 */

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

/** Below this a card is not a card; above it, one render can hurt the box. */
const MIN_DIMENSION = 200
/** 2× the real card — room for a retina variant, nothing near an OOM. */
const MAX_DIMENSION = 2400

export function card_dimension({ requested, fallback }: { requested: unknown, fallback: number }): number {
  // Nonsense (missing, non-numeric, zero, negative) keeps the pre-2026-07-29
  // behaviour of drawing the real card rather than arguing with the caller.
  if (typeof requested !== 'number' || !Number.isFinite(requested) || requested <= 0)
    return fallback
  return Math.min(Math.max(Math.round(requested), MIN_DIMENSION), MAX_DIMENSION)
}

if (import.meta.vitest) {
  describe(card_dimension, () => {
    test('the real card passes through untouched', () => {
      expect(card_dimension({ requested: CARD_WIDTH, fallback: CARD_WIDTH })).toBe(1200)
      expect(card_dimension({ requested: CARD_HEIGHT, fallback: CARD_HEIGHT })).toBe(630)
    })

    test('THE FIX: a 20,000×20,000 request can no longer ask for a ~1.6 GB allocation', () => {
      expect(card_dimension({ requested: 20_000, fallback: CARD_WIDTH })).toBe(MAX_DIMENSION)
      expect(card_dimension({ requested: 1e9, fallback: CARD_HEIGHT })).toBe(MAX_DIMENSION)
    })

    test('zero and negative sizes draw the real card; a small positive one meets the floor', () => {
      expect(card_dimension({ requested: 0, fallback: CARD_WIDTH })).toBe(CARD_WIDTH)
      expect(card_dimension({ requested: -5000, fallback: CARD_WIDTH })).toBe(CARD_WIDTH)
      expect(card_dimension({ requested: 12, fallback: CARD_WIDTH })).toBe(MIN_DIMENSION)
    })

    test('anything that is not a finite number falls back to the card default', () => {
      expect(card_dimension({ requested: undefined, fallback: CARD_WIDTH })).toBe(CARD_WIDTH)
      expect(card_dimension({ requested: '4000', fallback: CARD_WIDTH })).toBe(CARD_WIDTH)
      expect(card_dimension({ requested: Number.NaN, fallback: CARD_HEIGHT })).toBe(CARD_HEIGHT)
      expect(card_dimension({ requested: Number.POSITIVE_INFINITY, fallback: CARD_HEIGHT })).toBe(CARD_HEIGHT)
      expect(card_dimension({ requested: { valueOf: () => 9e9 }, fallback: CARD_WIDTH })).toBe(CARD_WIDTH)
    })

    test('a fractional size is rounded, so the renderer never sees a sub-pixel viewport', () => {
      expect(card_dimension({ requested: 800.6, fallback: CARD_WIDTH })).toBe(801)
    })
  })
}
