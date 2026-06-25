/**
 * Great-circle distance helpers for geo-splitting real-user latency by how far
 * a visitor is from the origin. The origin is a single VPS in Boston, so
 * physical distance is a direct driver of TTFB — these turn a stored lat/long
 * (CF's IP-geolocation centroid) into a distance and a coarse bucket the
 * analytics layer groups on. We deliberately do NOT store the bucket: with the
 * raw coords on the row we can re-bucket any way later without a migration.
 */

/** Hostinger Boston datacenter (approx). The latency reference point. */
export const ORIGIN_BOSTON = { latitude: 42.3601, longitude: -71.0589 } as const

const EARTH_RADIUS_KM = 6371

function to_radians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Great-circle distance in km between two lat/long points (haversine). */
export function haversine_km({ lat1, lng1, lat2, lng2 }: {
  lat1: number
  lng1: number
  lat2: number
  lng2: number
}): number {
  const d_lat = to_radians(lat2 - lat1)
  const d_lng = to_radians(lng2 - lng1)
  const a
    = Math.sin(d_lat / 2) ** 2
      + Math.cos(to_radians(lat1)) * Math.cos(to_radians(lat2)) * Math.sin(d_lng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Distance in km from a point to the Boston origin. Returns null when either
 * coordinate is missing/invalid (e.g. CF location headers not enabled yet).
 */
export function distance_to_origin_km({ latitude, longitude }: {
  latitude: number | null | undefined
  longitude: number | null | undefined
}): number | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number')
    return null
  if (Number.isNaN(latitude) || Number.isNaN(longitude))
    return null
  return haversine_km({ lat1: latitude, lng1: longitude, lat2: ORIGIN_BOSTON.latitude, lng2: ORIGIN_BOSTON.longitude })
}

/** Coarse distance buckets (ascending), for grouping TTFB by distance-to-origin. */
export const DISTANCE_BUCKETS = ['< 500 km', '500–2,000 km', '2,000–5,000 km', '5,000–10,000 km', '> 10,000 km'] as const
export type DistanceBucket = typeof DISTANCE_BUCKETS[number]

/** Map a km distance into one of DISTANCE_BUCKETS. */
export function distance_bucket(km: number): DistanceBucket {
  if (km < 500)
    return '< 500 km'
  if (km < 2000)
    return '500–2,000 km'
  if (km < 5000)
    return '2,000–5,000 km'
  if (km < 10000)
    return '5,000–10,000 km'
  return '> 10,000 km'
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest
  describe(haversine_km, () => {
    it('is ~0 for identical points', () => {
      expect(haversine_km({ lat1: 42.36, lng1: -71.06, lat2: 42.36, lng2: -71.06 })).toBe(0)
    })

    it('matches a known Boston→Los Angeles distance (~4170 km)', () => {
      const km = haversine_km({ lat1: 42.3601, lng1: -71.0589, lat2: 34.0522, lng2: -118.2437 })
      expect(Math.round(km / 10) * 10).toBe(4170)
    })

    it('matches a known Boston→New York distance (~305 km)', () => {
      const km = haversine_km({ lat1: 42.3601, lng1: -71.0589, lat2: 40.7128, lng2: -74.006 })
      expect(Math.round(km / 5) * 5).toBe(305)
    })
  })

  describe(distance_to_origin_km, () => {
    it('returns null when a coordinate is missing', () => {
      expect(distance_to_origin_km({ latitude: 34.05, longitude: null })).toBeNull()
      expect(distance_to_origin_km({ latitude: null, longitude: -118.24 })).toBeNull()
      expect(distance_to_origin_km({ latitude: Number.NaN, longitude: 0 })).toBeNull()
    })

    it('computes distance from the Boston origin', () => {
      const km = distance_to_origin_km({ latitude: 40.7128, longitude: -74.006 })
      expect(km).not.toBeNull()
      expect(Math.round((km as number) / 5) * 5).toBe(305)
    })
  })

  describe(distance_bucket, () => {
    it('buckets NYC-grade distance under 500 km', () => {
      expect(distance_bucket(305)).toBe('< 500 km')
    })

    it('buckets LA-grade distance into 2,000–5,000 km', () => {
      expect(distance_bucket(4170)).toBe('2,000–5,000 km')
    })

    it('buckets trans-Pacific distance over 10,000 km', () => {
      expect(distance_bucket(15000)).toBe('> 10,000 km')
    })
  })
}
