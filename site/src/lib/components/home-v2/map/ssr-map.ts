import { geoPath } from 'd3-geo'
import * as topojson from 'topojson-client'
import countries_topo from '$lib/components/globe/data/countries-110m.json'
import { fit_equal_earth, natural_height } from './projection'

/**
 * Server-rendered map underlay: the land silhouette + all dictionary dots as
 * two path strings inside a fixed viewBox. Painted straight from the HTML
 * stream (no JS needed); the interactive canvas replaces it after hydration.
 */
export interface SsrMap {
  width: number
  height: number
  land_d: string
  dots_d: string
}

export const SSR_MAP_WIDTH = 960

let cached_land_d: string | null = null

function get_projection() {
  const height = natural_height(SSR_MAP_WIDTH)
  return { projection: fit_equal_earth({ width: SSR_MAP_WIDTH, height }), height }
}

export function build_ssr_map({ points }: { points: [number, number][] }): SsrMap {
  const { projection, height } = get_projection()
  const path = geoPath(projection).digits(1)

  if (!cached_land_d) {
    // land silhouette merged from the country polygons — saves shipping land-110m
    const land = topojson.merge(countries_topo as any, (countries_topo as any).objects.countries.geometries)
    cached_land_d = path(land as any) ?? ''
  }

  const dots_d = points.length
    ? geoPath(projection).digits(1).pointRadius(2.2)({ type: 'MultiPoint', coordinates: points }) ?? ''
    : ''

  return { width: SSR_MAP_WIDTH, height, land_d: cached_land_d, dots_d }
}

if (import.meta.vitest) {
  test('build_ssr_map renders land + dot paths', () => {
    const { land_d, dots_d, width, height } = build_ssr_map({ points: [[0, 0], [120, -30]] })
    expect(land_d.length).toBeGreaterThan(10_000)
    expect(width).toBe(960)
    expect(height).toBe(natural_height(960))
    expect((dots_d.match(/M/g) ?? []).length).toBe(2) // one circle (absolute moveto) per dot
  })
}
