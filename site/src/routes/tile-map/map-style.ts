// Kitchen-sink styling of the Protomaps basemap layers — draw everything the
// tiles offer so we can see what a custom minimal tileset should keep.

export const WATER_COLOR = '#a3c7e1'
export const EARTH_COLOR = '#f0eee8'

export interface FillStyle { type: 'fill', color: string, order: number, bleed?: boolean }
export interface LineStyle { type: 'line', color: string, width: number, order: number, dash?: number[] }
export type BucketStyle = FillStyle | LineStyle

export interface LabelSpec {
  name: string
  lonlat: [number, number]
  min_zoom: number
  priority: number // lower places first (wins collisions)
  size: number
  weight: string
  color: string
  italic?: boolean
  dot?: boolean
}

const landcover_colors: Record<string, string> = {
  forest: '#cadfb6',
  wood: '#cadfb6',
  grassland: '#e1ead1',
  scrub: '#d9e5c3',
  farmland: '#eeead9',
  barren: '#e7e1d2',
  sand: '#eee5c8',
  glacier: '#f4f9fb',
  urban_area: '#dfdad4',
}

const landuse_colors: Record<string, string> = {
  park: '#c3ddad',
  national_park: '#c3ddad',
  nature_reserve: '#cbe0b8',
  protected_area: '#cbe0b8',
  forest: '#cadfb6',
  wood: '#cadfb6',
  meadow: '#e1ead1',
  grassland: '#e1ead1',
  scrub: '#d9e5c3',
  farmland: '#eeead9',
  orchard: '#dce8c4',
  wetland: '#d5e4da',
  residential: '#e4dfd7',
  industrial: '#e0dcda',
  military: '#e0d8cc',
  sand: '#eee5c8',
  beach: '#f1e8c9',
  bare_rock: '#ded8ca',
  glacier: '#f4f9fb',
  airfield: '#e3e0e8',
  aerodrome: '#e3e0e8',
  hospital: '#f0ddd9',
  school: '#ece5d3',
}

const road_styles: Record<string, { color: string, width: number }> = {
  highway: { color: '#e8a25f', width: 1.6 },
  major_road: { color: '#c2b8a5', width: 1.1 },
  medium_road: { color: '#cfc8ba', width: 0.9 },
  minor_road: { color: '#d8d2c6', width: 0.7 },
  path: { color: '#d8d2c6', width: 0.5 },
  rail: { color: '#c4bfd1', width: 0.8 },
}

const boundary_styles: Record<string, { color: string, width: number, dash?: number[] }> = {
  country: { color: '#8b7f9e', width: 1.2 },
  unrecognized_country: { color: '#8b7f9e', width: 1.1, dash: [4, 3] },
  region: { color: '#a89fba', width: 0.8, dash: [3, 2] },
  unrecognized_region: { color: '#a89fba', width: 0.8, dash: [3, 2] },
  overlay_limit: { color: '#a89fba', width: 0.8, dash: [2, 2] },
}

export function get_bucket_style({ layer, kind, geom_type }: { layer: string, kind: string, geom_type: 1 | 2 | 3 }): BucketStyle | undefined {
  if (geom_type === 1) return undefined // points become labels, not paths
  if (layer === 'earth') return geom_type === 3 ? { type: 'fill', color: EARTH_COLOR, order: 0 } : undefined
  // bleed: the raster-derived landcover stops short of tile edges (visible when overzoomed) — fatten fills to knit tiles together
  if (layer === 'landcover' && geom_type === 3) return { type: 'fill', color: landcover_colors[kind] || '#e8e4d8', order: 10, bleed: true }
  if (layer === 'landuse' && geom_type === 3) return { type: 'fill', color: landuse_colors[kind] || '#e8e4d8', order: 20 }
  if (layer === 'water') return geom_type === 3 ? { type: 'fill', color: WATER_COLOR, order: 30 } : { type: 'line', color: WATER_COLOR, width: 1, order: 31 }
  if (layer === 'physical_line') return { type: 'line', color: WATER_COLOR, width: 1, order: 40 }
  if (layer === 'buildings' && geom_type === 3) return { type: 'fill', color: '#dcd7cf', order: 45 }
  if (layer === 'roads') return { type: 'line', order: 50, ...(road_styles[kind] || road_styles.minor_road) }
  if (layer === 'transit') return { type: 'line', color: '#c4bfd1', width: 0.8, dash: [4, 3], order: 52 }
  if (layer === 'boundaries') return { type: 'line', order: 60, ...(boundary_styles[kind] || boundary_styles.region) }
  return undefined
}

export function get_label_spec({ layer, geom_type, properties, geometry }: { layer: string, geom_type: number, properties: Record<string, unknown>, geometry: GeoJSON.Geometry }): LabelSpec | undefined {
  if (geom_type !== 1) return undefined
  const name = typeof properties.name === 'string' ? properties.name : undefined
  if (!name) return undefined
  const lonlat = (geometry.type === 'Point'
    ? geometry.coordinates
    : geometry.type === 'MultiPoint' ? geometry.coordinates[0] : undefined) as [number, number] | undefined
  if (!lonlat) return undefined
  if (Math.abs(lonlat[0]) > 180 || Math.abs(lonlat[1]) > 90) return undefined // tile-buffer duplicate from across the antimeridian

  const kind = String(properties.kind ?? '')
  const tagged_min_zoom = typeof properties.min_zoom === 'number' ? properties.min_zoom : undefined
  const rank = typeof properties.population_rank === 'number' ? properties.population_rank : 0

  if (layer === 'places') {
    const min_zoom = tagged_min_zoom ?? 8
    if (kind === 'country') return { name, lonlat, min_zoom, priority: 20 - rank, size: Math.min(11 + Math.max(rank - 12, 0), 16), weight: '700', color: '#6a6152' }
    if (kind === 'region') return { name, lonlat, min_zoom, priority: 45, size: 11, weight: '400', color: '#93887b', italic: true }
    if (kind === 'locality') return { name, lonlat, min_zoom, priority: 70 - rank, size: rank >= 13 ? 13.5 : rank >= 11 ? 12.5 : 11.5, weight: rank >= 12 ? '600' : '400', color: '#3b382f', dot: true }
    return undefined
  }
  if (layer === 'water') {
    const min_zoom = tagged_min_zoom ?? (kind === 'ocean' ? 0 : 4)
    return { name, lonlat, min_zoom, priority: 40, size: kind === 'ocean' ? 12.5 : 11, weight: '400', color: '#5b8db4', italic: true }
  }
  if (layer === 'earth' || layer === 'physical_point')
    return { name, lonlat, min_zoom: tagged_min_zoom ?? 5, priority: 80, size: 10.5, weight: '400', color: '#8d8471', italic: true }
  if (layer === 'pois')
    return { name, lonlat, min_zoom: Math.max(tagged_min_zoom ?? 6, 6), priority: 90, size: 10.5, weight: '400', color: '#55855a', italic: true }
  return undefined
}
