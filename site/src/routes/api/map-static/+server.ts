import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { IPoint, IRegion } from '$lib/types'
import { env } from '$env/dynamic/private'
import { PUBLIC_mapboxAccessToken } from '$env/static/public'
import { ResponseCodes } from '$lib/constants'
import { shapeGeoJson } from '$lib/components/maps/mapbox/static/shape-geo-json'

// Server-cached proxy for the Mapbox Static Images API. Every unique
// points/regions/size/mode combination is fetched from Mapbox at most once per
// 30 days (the Mapbox TOS caching allowance) and served from disk after that —
// per-visitor traffic never reaches Mapbox. The URL encodes the coordinates, so
// coordinate edits bust the browser cache (long immutable max-age) naturally.

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const BROWSER_CACHE_SECONDS = 30 * 24 * 60 * 60

const STYLES = {
  light: 'outdoors-v12',
  dark: 'dark-v11',
} as const

const MAX_POINTS = 50
const MAX_REGIONS = 20
const MAX_REGION_COORDINATES = 200

function clamp({ value, min, max }: { value: number, min: number, max: number }) {
  return Math.min(max, Math.max(min, value))
}

function parse_number(coordinate: unknown): coordinate is number {
  return typeof coordinate === 'number' && Number.isFinite(coordinate)
}

function parse_points(raw: string | null): IPoint[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    error(ResponseCodes.BAD_REQUEST, 'points is not valid JSON')
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_POINTS)
    error(ResponseCodes.BAD_REQUEST, 'points must be an array of at most 50 points')
  return parsed.map((point: IPoint) => {
    if (!parse_number(point?.coordinates?.longitude) || !parse_number(point?.coordinates?.latitude))
      error(ResponseCodes.BAD_REQUEST, 'each point needs numeric coordinates')
    return { coordinates: { longitude: point.coordinates.longitude, latitude: point.coordinates.latitude } }
  })
}

function parse_regions(raw: string | null): IRegion[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    error(ResponseCodes.BAD_REQUEST, 'regions is not valid JSON')
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_REGIONS)
    error(ResponseCodes.BAD_REQUEST, 'regions must be an array of at most 20 regions')
  return parsed.map((region: IRegion) => {
    if (!Array.isArray(region?.coordinates) || region.coordinates.length < 3 || region.coordinates.length > MAX_REGION_COORDINATES)
      error(ResponseCodes.BAD_REQUEST, 'each region needs 3-200 coordinates')
    return {
      coordinates: region.coordinates.map((coordinate) => {
        if (!parse_number(coordinate?.longitude) || !parse_number(coordinate?.latitude))
          error(ResponseCodes.BAD_REQUEST, 'each region coordinate needs numeric longitude/latitude')
        return { longitude: coordinate.longitude, latitude: coordinate.latitude }
      }),
    }
  })
}

async function fetch_from_mapbox(url: string): Promise<Buffer | null> {
  try {
    // The public token is URL-restricted to livingdictionaries.app — Mapbox
    // checks the Referer, so the proxy identifies as the site it serves.
    const response = await fetch(url, { headers: { referer: 'https://livingdictionaries.app/' } })
    if (!response.ok) {
      console.error(`map-static: mapbox responded ${response.status}`)
      return null
    }
    return Buffer.from(await response.arrayBuffer())
  } catch (err) {
    console.error(`map-static: mapbox fetch failed: ${(err as Error).message}`)
    return null
  }
}

export const GET: RequestHandler = async ({ url }) => {
  const token = env.MAPBOX_ACCESS_TOKEN || PUBLIC_mapboxAccessToken
  if (!token || token === 'dummy')
    error(ResponseCodes.NOT_FOUND, 'no mapbox token configured')

  const points = parse_points(url.searchParams.get('points'))
  const regions = parse_regions(url.searchParams.get('regions'))
  if (!points.length && !regions.length)
    error(ResponseCodes.BAD_REQUEST, 'points or regions required')

  const width = clamp({ value: Number(url.searchParams.get('w')) || 300, min: 50, max: 1280 })
  const height = clamp({ value: Number(url.searchParams.get('h')) || 200, min: 50, max: 1280 })
  const mode = url.searchParams.get('mode') === 'dark' ? 'dark' : 'light'
  const zoom = clamp({ value: Number(url.searchParams.get('zoom')) || 3, min: 0, max: 15 })

  const geojson = shapeGeoJson(points, regions)
  const overlay = encodeURIComponent(JSON.stringify(geojson))
  const is_single_point = points.length === 1 && !regions.length
  const viewport = is_single_point
    ? `${points[0].coordinates.longitude},${points[0].coordinates.latitude},${zoom}`
    : 'auto'
  // Explicit padding on auto-fit keeps edge markers clear of the frame even when
  // the client displays the image with a slightly different aspect (object-fit:
  // cover after quantized sizing — see static_map_height).
  const padding = viewport === 'auto' ? '&padding=40' : ''
  const mapbox_url = `https://api.mapbox.com/styles/v1/mapbox/${STYLES[mode]}/static/geojson(${overlay})/${viewport}/${width}x${height}@2x?logo=false${padding}&access_token=${token}`

  const cache_key = createHash('sha256')
    .update(JSON.stringify({ geojson, viewport, width, height, mode }))
    .digest('hex')
  const cache_dir = path.join(env.DATA_DIR || '.data', 'cache', 'map-static')
  const cache_path = path.join(cache_dir, `${cache_key}.png`)

  let cached: { buffer: Buffer, fresh: boolean } | null = null
  try {
    const file_stat = await stat(cache_path)
    cached = {
      buffer: await readFile(cache_path),
      fresh: Date.now() - file_stat.mtimeMs < CACHE_TTL_MS,
    }
  } catch {
    // cache miss
  }

  let image = cached?.fresh ? cached.buffer : null
  if (!image) {
    image = await fetch_from_mapbox(mapbox_url)
    if (image) {
      await mkdir(cache_dir, { recursive: true })
      await writeFile(cache_path, image)
    } else if (cached) {
      image = cached.buffer // Mapbox unreachable — serve the stale copy
    }
  }
  if (!image)
    error(ResponseCodes.BAD_GATEWAY, 'map image unavailable')

  return new Response(new Uint8Array(image), {
    headers: {
      'content-type': 'image/png',
      'cache-control': `public, max-age=${BROWSER_CACHE_SECONDS}, immutable`,
    },
  })
}
