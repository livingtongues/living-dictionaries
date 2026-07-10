import type { IPoint, IRegion } from '$lib/types'

export interface MapStaticUrlOptions {
  points?: IPoint[]
  regions?: IRegion[]
  width: number
  height: number
  mode: 'light' | 'dark'
  single_point_zoom?: number
}

// Not a fetch wrapper — this endpoint serves an image, so callers set the
// returned URL as an <img src>. Keep only the coordinate fields in the params:
// labels/colors would fragment the server cache without changing the image.
export function map_static_url({ points = [], regions = [], width, height, mode, single_point_zoom }: MapStaticUrlOptions): string {
  const params = new URLSearchParams()
  if (points.length)
    params.set('points', JSON.stringify(points.map(({ coordinates }) => ({ coordinates }))))
  if (regions.length)
    params.set('regions', JSON.stringify(regions.map(({ coordinates }) => ({ coordinates }))))
  params.set('w', String(width))
  params.set('h', String(height))
  params.set('mode', mode)
  if (single_point_zoom !== undefined)
    params.set('zoom', String(single_point_zoom))
  return `/api/map-static?${params.toString()}`
}
