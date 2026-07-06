import { PMTiles } from 'pmtiles'
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'
import { geoArea } from 'd3-geo'

export interface TileFeature {
  geom_type: 1 | 2 | 3 // 1 point, 2 line, 3 polygon
  properties: Record<string, unknown>
  geojson: GeoJSON.Feature
}

export type TileLayers = Record<string, TileFeature[]>

const archive = new PMTiles('/tile-map/data')

// Edge tiles carry buffer geometry past ±180°; d3 normalizes those longitudes to the
// opposite side of the world, wrapping fills/strokes across the map. Clamp lines and
// polygons a hair inside the antimeridian (squashes the duplicated buffer sliver).
// Points are NOT clamped — out-of-range buffer-duplicate labels get dropped instead.
const LON_LIMIT = 179.999
const LAT_LIMIT = 89.999

function clamp_positions(coordinates: unknown): void {
  if (!Array.isArray(coordinates)) return
  if (typeof coordinates[0] === 'number') {
    coordinates[0] = Math.max(-LON_LIMIT, Math.min(LON_LIMIT, coordinates[0] as number))
    coordinates[1] = Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, coordinates[1] as number))
    return
  }
  for (const nested of coordinates) clamp_positions(nested)
}

// The basemap's ring winding is inconsistent across layers/zooms, and d3-geo renders a
// wrongly-wound ring as its spherical complement (globe-covering fill). Rewind every
// ring by measured spherical area: exteriors ≤ half sphere, holes ≥ half sphere.
// (Only breaks on legitimately-hemisphere-plus rings, which exist solely at z0 — unused.)
const HALF_SPHERE = 2 * Math.PI

function rewind_polygon(rings: GeoJSON.Position[][]): void {
  rings.forEach((ring, index) => {
    const area = geoArea({ type: 'Polygon', coordinates: [ring] })
    if (index === 0 ? area > HALF_SPHERE : area < HALF_SPHERE) ring.reverse()
  })
}

function rewind_for_d3(geometry: GeoJSON.Geometry): void {
  if (geometry.type === 'Polygon') rewind_polygon(geometry.coordinates)
  else if (geometry.type === 'MultiPolygon') for (const polygon of geometry.coordinates) rewind_polygon(polygon)
}

export async function fetch_tile({ z, x, y }: { z: number, x: number, y: number }): Promise<TileLayers | undefined> {
  const result = await archive.getZxy(z, x, y)
  if (!result?.data?.byteLength) return undefined
  const tile = new VectorTile(new PbfReader(new Uint8Array(result.data)))
  const layers: TileLayers = {}
  for (const [name, layer] of Object.entries(tile.layers)) {
    const features: TileFeature[] = []
    for (let index = 0; index < layer.length; index++) {
      const raw = layer.feature(index)
      const geojson = raw.toGeoJSON(x, y, z) as GeoJSON.Feature
      if (raw.type !== 1 && 'coordinates' in geojson.geometry) clamp_positions(geojson.geometry.coordinates)
      rewind_for_d3(geojson.geometry)
      features.push({
        geom_type: raw.type as 1 | 2 | 3,
        properties: raw.properties as Record<string, unknown>,
        geojson,
      })
    }
    layers[name] = features
  }
  return layers
}
