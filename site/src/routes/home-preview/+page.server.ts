import type { DictionaryCoordinates } from '$lib/db/schemas/shared.types'
import type { MapDict } from '$lib/components/home-v2/types'
import type { PageServerLoad } from './$types'
import { build_ssr_map } from '$lib/components/home-v2/map/ssr-map'
import { get_shared_db } from '$lib/db/server/shared-db'

interface SlimRow {
  id: string
  url: string
  name: string
  alternate_names: string | null
  gloss_languages: string | null
  location: string | null
  coordinates: string | null
  entry_count: number
}

function primary_point(coordinates: DictionaryCoordinates | null): { lat: number | null, lng: number | null } {
  const point = coordinates?.points?.[0]?.coordinates
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude))
    return { lat: null, lng: null }
  return { lat: point.latitude, lng: point.longitude }
}

function parse_json_array(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []
  } catch {
    return []
  }
}

export const load: PageServerLoad = () => {
  const db = get_shared_db()
  const rows = db.prepare(
    'SELECT id, url, name, alternate_names, gloss_languages, location, coordinates, entry_count FROM dictionaries WHERE public = 1',
  ).all() as SlimRow[]

  const map_dicts: MapDict[] = rows.map((row) => {
    let coordinates: DictionaryCoordinates | null = null
    try {
      coordinates = row.coordinates ? JSON.parse(row.coordinates) : null
    } catch { /* malformed coordinates → no dot */ }
    const { lat, lng } = primary_point(coordinates)
    return {
      id: row.id,
      url: row.url ?? row.id,
      name: row.name,
      lat,
      lng,
      entry_count: row.entry_count,
      gloss_languages: parse_json_array(row.gloss_languages),
      location: row.location,
      alternate_names: parse_json_array(row.alternate_names),
    }
  })

  const points = map_dicts
    .filter(dict => dict.lat !== null && dict.lng !== null)
    .map(dict => [dict.lng, dict.lat] as [number, number])

  return {
    map_dicts,
    ssr_map: build_ssr_map({ points }),
  }
}
