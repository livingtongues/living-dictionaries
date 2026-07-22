import type { Coordinates, IPoint, IRegion, LngLatFull } from '$lib/types'

/**
 * Strict validator/normalizer for the `coordinates` geometry accepted on the
 * `/api/v1` entry AND dialect write endpoints. The stored shape (identical for
 * entries, dialects, and dictionaries) is `{ points?, regions? }` where a point
 * is a single `{ longitude, latitude }` and a region is a ring of ≥3 such
 * vertices (see `$lib/types/coordinates.interface.ts`).
 *
 * Semantics for {@link to_coordinates}:
 *   - `undefined` in → `undefined` out  (field omitted → leave untouched)
 *   - `null` in      → `null` out        (explicit clear)
 *   - object in      → validated `{ points?, regions? }`, or `null` if it
 *                      normalizes to empty (no points and no regions)
 *   - anything invalid → THROWS with a precise path (so the POST path reports
 *     the item in `failed` and the PATCH path returns 400).
 *
 * Entry coordinates = per-word attestation/elicitation points; dialect
 * coordinates = the variety's areal extent (stored once on the dialect row).
 */

export const MAX_COORDINATE_POINTS = 100
export const MAX_COORDINATE_REGIONS = 20
export const MIN_REGION_VERTICES = 3
export const MAX_REGION_VERTICES = 100

function is_finite_number(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validate_lng_lat(value: unknown, path: string): LngLatFull {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${path} must be an object with numeric longitude and latitude`)
  const { longitude, latitude } = value as Record<string, unknown>
  if (!is_finite_number(longitude))
    throw new Error(`${path}.longitude must be a finite number`)
  if (!is_finite_number(latitude))
    throw new Error(`${path}.latitude must be a finite number`)
  if (longitude < -180 || longitude > 180)
    throw new Error(`${path}.longitude must be between -180 and 180`)
  if (latitude < -90 || latitude > 90)
    throw new Error(`${path}.latitude must be between -90 and 90`)
  return { longitude, latitude }
}

/** Trim + drop an empty/absent optional string label/color. */
function optional_string(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null)
    return undefined
  if (typeof value !== 'string')
    throw new Error(`${path} must be a string`)
  const trimmed = value.trim()
  return trimmed || undefined
}

function with_label_color<T extends object>(base: T, source: Record<string, unknown>, path: string): T {
  const label = optional_string(source.label, `${path}.label`)
  const color = optional_string(source.color, `${path}.color`)
  return { ...base, ...(label ? { label } : {}), ...(color ? { color } : {}) }
}

export function to_coordinates(value: unknown): Coordinates | null | undefined {
  if (value === undefined)
    return undefined
  if (value === null)
    return null
  if (typeof value !== 'object' || Array.isArray(value))
    throw new Error('coordinates must be an object with optional `points` and `regions` arrays')

  const source = value as Record<string, unknown>

  let points: IPoint[] | undefined
  if (source.points !== undefined && source.points !== null) {
    if (!Array.isArray(source.points))
      throw new Error('coordinates.points must be an array')
    if (source.points.length > MAX_COORDINATE_POINTS)
      throw new Error(`coordinates.points may contain at most ${MAX_COORDINATE_POINTS} points`)
    const built = source.points.map((raw, index): IPoint => {
      const path = `coordinates.points[${index}]`
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
        throw new Error(`${path} must be an object`)
      const point = raw as Record<string, unknown>
      const coordinates = validate_lng_lat(point.coordinates, `${path}.coordinates`)
      return with_label_color<IPoint>({ coordinates }, point, path)
    })
    if (built.length)
      points = built
  }

  let regions: IRegion[] | undefined
  if (source.regions !== undefined && source.regions !== null) {
    if (!Array.isArray(source.regions))
      throw new Error('coordinates.regions must be an array')
    if (source.regions.length > MAX_COORDINATE_REGIONS)
      throw new Error(`coordinates.regions may contain at most ${MAX_COORDINATE_REGIONS} regions`)
    const built = source.regions.map((raw, index): IRegion => {
      const path = `coordinates.regions[${index}]`
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
        throw new Error(`${path} must be an object`)
      const region = raw as Record<string, unknown>
      if (!Array.isArray(region.coordinates))
        throw new Error(`${path}.coordinates must be an array of ≥${MIN_REGION_VERTICES} points`)
      if (region.coordinates.length < MIN_REGION_VERTICES)
        throw new Error(`${path}.coordinates must contain at least ${MIN_REGION_VERTICES} vertices`)
      if (region.coordinates.length > MAX_REGION_VERTICES)
        throw new Error(`${path}.coordinates may contain at most ${MAX_REGION_VERTICES} vertices`)
      const coordinates = region.coordinates.map((vertex, vertex_index) =>
        validate_lng_lat(vertex, `${path}.coordinates[${vertex_index}]`))
      return with_label_color<IRegion>({ coordinates }, region, path)
    })
    if (built.length)
      regions = built
  }

  if (!points && !regions)
    return null
  return { ...(points ? { points } : {}), ...(regions ? { regions } : {}) }
}

if (import.meta.vitest) {
  describe(to_coordinates, () => {
    it('passes undefined/null through untouched', () => {
      expect(to_coordinates(undefined)).toBe(undefined)
      expect(to_coordinates(null)).toBe(null)
    })

    it('normalizes a valid point with label/color', () => {
      expect(to_coordinates({ points: [{ coordinates: { longitude: 77.2, latitude: 28.6 }, label: ' Khirsu ', color: '#f00' }] }))
        .toEqual({ points: [{ coordinates: { longitude: 77.2, latitude: 28.6 }, label: 'Khirsu', color: '#f00' }] })
    })

    it('normalizes a valid region', () => {
      const ring = [{ longitude: 0, latitude: 0 }, { longitude: 1, latitude: 1 }, { longitude: 2, latitude: 0 }]
      expect(to_coordinates({ regions: [{ coordinates: ring }] }))
        .toEqual({ regions: [{ coordinates: ring }] })
    })

    it('drops empty label/color and empty arrays → null', () => {
      expect(to_coordinates({ points: [{ coordinates: { longitude: 1, latitude: 2 }, label: '   ' }] }))
        .toEqual({ points: [{ coordinates: { longitude: 1, latitude: 2 } }] })
      expect(to_coordinates({})).toBe(null)
      expect(to_coordinates({ points: [], regions: [] })).toBe(null)
    })

    it('rejects out-of-range and non-finite coordinates', () => {
      expect(() => to_coordinates({ points: [{ coordinates: { longitude: 200, latitude: 0 } }] })).toThrow(/longitude must be between/)
      expect(() => to_coordinates({ points: [{ coordinates: { longitude: 0, latitude: 91 } }] })).toThrow(/latitude must be between/)
      expect(() => to_coordinates({ points: [{ coordinates: { longitude: Number.NaN, latitude: 0 } }] })).toThrow(/finite number/)
    })

    it('rejects a region with fewer than 3 vertices', () => {
      expect(() => to_coordinates({ regions: [{ coordinates: [{ longitude: 0, latitude: 0 }, { longitude: 1, latitude: 1 }] }] }))
        .toThrow(/at least 3 vertices/)
    })

    it('enforces the point/region caps', () => {
      const many_points = Array.from({ length: MAX_COORDINATE_POINTS + 1 }, () => ({ coordinates: { longitude: 0, latitude: 0 } }))
      expect(() => to_coordinates({ points: many_points })).toThrow(/at most 100 points/)
      const many_regions = Array.from({ length: MAX_COORDINATE_REGIONS + 1 }, () => ({ coordinates: [{ longitude: 0, latitude: 0 }, { longitude: 1, latitude: 1 }, { longitude: 2, latitude: 0 }] }))
      expect(() => to_coordinates({ regions: many_regions })).toThrow(/at most 20 regions/)
    })

    it('rejects a non-object value', () => {
      expect(() => to_coordinates('nope')).toThrow(/must be an object/)
      expect(() => to_coordinates([])).toThrow(/must be an object/)
    })
  })
}
