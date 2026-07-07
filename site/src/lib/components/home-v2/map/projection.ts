import type { GeoPermissibleObjects } from 'd3-geo'
import { geoEqualEarth, geoPath } from 'd3-geo'

export const SPHERE = { type: 'Sphere' } as const satisfies GeoPermissibleObjects

/**
 * The slice of the globe we actually fit + show — Antarctica trimmed off the
 * bottom (south clamp ~-58°, above Antarctica but below Cape Horn / southern NZ),
 * the empty far-northern ice capped (~84°), and the empty central Pacific west
 * of Hawaii trimmed (west clamp -145° at the equator — Hawaii falls outside the
 * crop, western Alaska including the Iñupiaq dot at -161.7°/64.9°N stays inside
 * because Equal Earth pulls high latitudes toward the center). Fitting to this
 * instead of the full SPHERE fills more of the frame with actual content.
 *
 * It's a MultiPoint sample, NOT a Polygon: a ring spanning all longitudes at a
 * parallel encloses a pole, so d3 fills it back to full sphere height. The grid
 * of points captures the true fitted bounds — the equator endpoints set the
 * width, lat 84 / -58 at lng 0 set the height.
 */
const SOUTH = -58
const NORTH = 84
const WEST = -145
const EAST = 180
const SAMPLE_LNGS = [WEST, -90, -45, 0, 45, 90, 135, EAST]
const SAMPLE_LATS = [SOUTH, -30, 0, 30, 60, NORTH]
export const VISIBLE_WORLD: GeoPermissibleObjects = {
  type: 'MultiPoint',
  coordinates: SAMPLE_LATS.flatMap(lat => SAMPLE_LNGS.map(lng => [lng, lat] as [number, number])),
}

/** Max zoom-in — roughly province/region level, deliberately not street level. */
export const MAX_ZOOM = 14
export const MIN_ZOOM = 1

/** Width / height of the trimmed world — drives the hero frame's aspect-ratio. */
export const WORLD_ASPECT = (() => {
  const projection = geoEqualEarth().fitWidth(960, VISIBLE_WORLD)
  const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(VISIBLE_WORLD)
  return (x1 - x0) / (y1 - y0)
})()

/**
 * Equal Earth fitted inside a box (letterboxes with empty ocean when the aspect
 * differs). The clip extent is pinned to the fitted world bounds so cropped land
 * (Antarctica below, Hawaii west) never paints into the letterbox.
 */
export function fit_equal_earth({ width, height, padding = 0 }: { width: number, height: number, padding?: number }) {
  const projection = geoEqualEarth().fitExtent([[padding, padding], [width - padding, height - padding]], VISIBLE_WORLD)
  const bounds = geoPath(projection).bounds(VISIBLE_WORLD)
  return projection.clipExtent(bounds)
}

/** Natural pixel height of the visible (trimmed) world at `width`. */
export function natural_height(width: number): number {
  const projection = geoEqualEarth().fitWidth(width, VISIBLE_WORLD)
  const [[, y0], [, y1]] = geoPath(projection).bounds(VISIBLE_WORLD)
  return Math.ceil(y1 - y0)
}

if (import.meta.vitest) {
  test('natural_height trims Antarctica + far-west Pacific → taller than the old full-width fit', () => {
    // full-sphere Equal Earth at 960 is 468px tall; the old Antarctica-only trim
    // was 420; cropping the west edge too narrows the world so the same width
    // fits a proportionally taller slice
    expect(natural_height(960)).toBe(466)
  })

  test('world aspect is wider than 2:1', () => {
    expect(WORLD_ASPECT > 2 && WORLD_ASPECT < 2.2).toBe(true)
  })

  test('the westmost dictionary dot (Iñupiaq) stays inside the crop; Hawaii falls outside', () => {
    const projection = fit_equal_earth({ width: 960, height: natural_height(960) })
    const [[x0]] = geoPath(projection).bounds(VISIBLE_WORLD)
    const [inupiaq_x] = projection([-161.7087, 64.9271])
    const [hawaii_x] = projection([-154.8, 19.5])
    expect(inupiaq_x > x0 + 40).toBe(true)
    expect(hawaii_x < x0).toBe(true)
  })
}
