import type { GeoPermissibleObjects } from 'd3-geo'
import { geoEqualEarth, geoPath } from 'd3-geo'

export const SPHERE = { type: 'Sphere' } as const satisfies GeoPermissibleObjects

/** Max zoom-in — roughly province/region level, deliberately not street level. */
export const MAX_ZOOM = 14
export const MIN_ZOOM = 1

/** Equal Earth fitted inside a box (letterboxes with ocean when aspect differs). */
export function fit_equal_earth({ width, height, padding = 0 }: { width: number, height: number, padding?: number }) {
  return geoEqualEarth().fitExtent([[padding, padding], [width - padding, height - padding]], SPHERE)
}

/** Natural pixel height of an Equal Earth world at `width` (aspect ≈ 2.05:1). */
export function natural_height(width: number): number {
  const projection = geoEqualEarth().fitWidth(width, SPHERE)
  const [[, y0], [, y1]] = geoPath(projection).bounds(SPHERE)
  return Math.ceil(y1 - y0)
}

if (import.meta.vitest) {
  test('natural_height keeps the Equal Earth aspect ratio', () => {
    expect(natural_height(960)).toBe(468)
  })
}
