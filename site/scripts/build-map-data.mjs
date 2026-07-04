/**
 * One-time (re-runnable) generator for the homepage map label datasets.
 * Downloads Natural Earth GeoJSON (cached in /tmp), plus the bundled
 * world-atlas countries topojson, and writes compact label arrays:
 *
 *   src/lib/components/home-v2/map/data/country-labels.json  (bundled — needed at first zoom)
 *       [[name, lng, lat, area_rank], ...]                   (110m, label point = largest polygon centroid)
 *   static/map-data/admin1.json  [[name, lng, lat, scalerank], ...]          (NE 10m label points, lazy-fetched)
 *   static/map-data/cities.json  [[name, lng, lat, scalerank, capital], ...] (NE 10m populated places, scalerank <= 4, lazy-fetched)
 *
 * Outputs are committed — this script only needs re-running to refresh the
 * source data. Usage: `node site/scripts/build-map-data.mjs`
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoArea, geoCentroid } from 'd3-geo'
import * as topojson from 'topojson-client'

const script_dir = dirname(fileURLToPath(import.meta.url))
const out_dir = join(script_dir, '..', 'static', 'map-data')
mkdirSync(out_dir, { recursive: true })

const NE_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'

async function fetch_cached(filename) {
  const cache_path = join('/tmp', filename)
  if (existsSync(cache_path))
    return JSON.parse(readFileSync(cache_path, 'utf8'))
  console.log(`downloading ${filename}…`)
  const response = await fetch(`${NE_BASE}/${filename}`)
  if (!response.ok)
    throw new Error(`${filename}: HTTP ${response.status}`)
  const text = await response.text()
  writeFileSync(cache_path, text)
  return JSON.parse(text)
}

function round(value) {
  return Math.round(value * 100) / 100
}

/** Label point for a country: centroid of its largest polygon (avoids overseas-territory drift). */
function largest_polygon_centroid(geometry) {
  if (geometry.type === 'Polygon')
    return geoCentroid(geometry)
  let best = null
  let best_area = -1
  for (const polygon_coords of geometry.coordinates) {
    const polygon = { type: 'Polygon', coordinates: polygon_coords }
    const area = geoArea(polygon)
    if (area > best_area) {
      best_area = area
      best = polygon
    }
  }
  return geoCentroid(best)
}

// --- countries (from the bundled world-atlas topojson) ---
const countries_topo = JSON.parse(readFileSync(join(script_dir, '..', 'src', 'lib', 'components', 'globe', 'data', 'countries-110m.json'), 'utf8'))
const countries_fc = topojson.feature(countries_topo, countries_topo.objects.countries)
const countries = countries_fc.features
  .filter(feature => feature.properties?.name && feature.properties.name !== 'Antarctica')
  .map(feature => ({ name: feature.properties.name, area: geoArea(feature.geometry), point: largest_polygon_centroid(feature.geometry) }))
  .sort((a, b) => b.area - a.area)
  .map(({ name, point }, area_rank) => [name, round(point[0]), round(point[1]), area_rank])
const country_labels_dir = join(script_dir, '..', 'src', 'lib', 'components', 'home-v2', 'map', 'data')
mkdirSync(country_labels_dir, { recursive: true })
writeFileSync(join(country_labels_dir, 'country-labels.json'), JSON.stringify(countries))
console.log(`country-labels.json: ${countries.length} labels`)

// --- admin-1 states/provinces (NE 10m, labels only) ---
const admin1_geo = await fetch_cached('ne_10m_admin_1_states_provinces.geojson')
const admin1 = admin1_geo.features
  .map((feature) => {
    const props = feature.properties ?? {}
    const name = props.name || props.name_en
    if (!name)
      return null
    const has_label_point = Number.isFinite(props.longitude) && Number.isFinite(props.latitude)
    const [lng, lat] = has_label_point ? [props.longitude, props.latitude] : geoCentroid(feature.geometry ?? { type: 'Point', coordinates: [0, 0] })
    if (!Number.isFinite(lng) || !Number.isFinite(lat))
      return null
    const scalerank = Number.isFinite(props.scalerank) ? props.scalerank : 9
    return [name, round(lng), round(lat), scalerank]
  })
  .filter(Boolean)
writeFileSync(join(out_dir, 'admin1.json'), JSON.stringify(admin1))
console.log(`admin1.json: ${admin1.length} labels`)

// --- cities (NE 10m populated places, biggest only) ---
const places_geo = await fetch_cached('ne_10m_populated_places_simple.geojson')
const cities = places_geo.features
  .map((feature) => {
    const props = feature.properties ?? {}
    if (!props.name || props.scalerank > 4)
      return null
    const [lng, lat] = feature.geometry?.coordinates ?? []
    if (!Number.isFinite(lng) || !Number.isFinite(lat))
      return null
    const is_capital = props.featurecla?.startsWith('Admin-0 capital') ? 1 : 0
    return [props.name, round(lng), round(lat), props.scalerank, is_capital]
  })
  .filter(Boolean)
writeFileSync(join(out_dir, 'cities.json'), JSON.stringify(cities))
console.log(`cities.json: ${cities.length} labels`)
