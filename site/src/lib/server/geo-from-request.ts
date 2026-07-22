/**
 * Extract the visitor's APPROXIMATE location from Cloudflare edge headers on an
 * incoming request, to stamp onto `client_logs` at ingest. CF resolves these at
 * its edge (spoof-resistant, server-trusted) and Caddy passes them through to the
 * origin untouched — the same path `cf-ipcountry` / `cf-connecting-ip` already
 * take. We deliberately do NOT read or store the raw client IP (PII); CF's
 * geolocation centroid is all we want.
 *
 * `cf-ipcountry` arrives whenever IP geolocation is on; the finer fields
 * (`cf-region-code` / `cf-ipcity` / `cf-iplatitude` / `cf-iplongitude`) are added by
 * the "Add visitor location headers" managed transform, enabled on the
 * livingdictionaries.app zone. Everything is best-effort: missing or malformed
 * headers yield null, never an error.
 */

export interface RequestGeo {
  country: string | null
  region: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
}

export const EMPTY_GEO: RequestGeo = { country: null, region: null, city: null, latitude: null, longitude: null }

/** Trim to null; collapse CF's empty-ish placeholders. */
function clean(value: string | null | undefined): string | null {
  if (!value)
    return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Parse a coordinate header to a finite number, else null. */
function coord(value: string | null | undefined): number | null {
  const text = clean(value)
  if (text === null)
    return null
  const num = Number.parseFloat(text)
  return Number.isFinite(num) ? num : null
}

/**
 * Read CF location headers off a request. Header lookups are case-insensitive.
 * Never throws.
 */
export function geo_from_request(request: { headers: Pick<Headers, 'get'> }): RequestGeo {
  try {
    const { headers } = request
    return {
      country: clean(headers.get('cf-ipcountry')),
      region: clean(headers.get('cf-region-code')),
      city: clean(headers.get('cf-ipcity')),
      latitude: coord(headers.get('cf-iplatitude')),
      longitude: coord(headers.get('cf-iplongitude')),
    }
  } catch {
    return { ...EMPTY_GEO }
  }
}

/**
 * Stable "area" key for rollups + analytics grouping: `<country>-<region>` when a
 * region is known (e.g. `US-CA`), else just the country (`US`), else null. Keeps
 * the forever rollup low-cardinality while still resolving US West vs East.
 */
export function geo_key({ country, region }: { country: string | null | undefined, region: string | null | undefined }): string | null {
  if (!country)
    return null
  return region ? `${country}-${region}` : country
}

if (import.meta.vitest) {
  function with_headers(map: Record<string, string>): { headers: Pick<Headers, 'get'> } {
    return { headers: new Headers(map) }
  }

  describe(geo_from_request, () => {
    it('parses a full set of CF location headers', () => {
      const geo = geo_from_request(with_headers({
        'CF-IPCountry': 'US',
        'cf-region-code': 'CA',
        'cf-ipcity': 'Los Angeles',
        'cf-iplatitude': '34.05220',
        'cf-iplongitude': '-118.24370',
      }))
      expect(geo).toEqual({ country: 'US', region: 'CA', city: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 })
    })

    it('returns nulls when only country is present (transform not enabled yet)', () => {
      const geo = geo_from_request(with_headers({ 'cf-ipcountry': 'GB' }))
      expect(geo).toEqual({ country: 'GB', region: null, city: null, latitude: null, longitude: null })
    })

    it('returns all-null when no CF headers are present (dev / direct origin)', () => {
      expect(geo_from_request(with_headers({}))).toEqual(EMPTY_GEO)
    })

    it('drops blank and non-numeric coordinate headers', () => {
      const geo = geo_from_request(with_headers({ 'cf-ipcountry': '  ', 'cf-iplatitude': 'n/a', 'cf-iplongitude': '' }))
      expect(geo).toEqual(EMPTY_GEO)
    })

    it('preserves CF unknown/Tor sentinels verbatim', () => {
      expect(geo_from_request(with_headers({ 'cf-ipcountry': 'T1' })).country).toBe('T1')
      expect(geo_from_request(with_headers({ 'cf-ipcountry': 'XX' })).country).toBe('XX')
    })
  })

  describe(geo_key, () => {
    it('joins country and region', () => {
      expect(geo_key({ country: 'US', region: 'CA' })).toBe('US-CA')
    })

    it('falls back to country when region is absent', () => {
      expect(geo_key({ country: 'GB', region: null })).toBe('GB')
    })

    it('is null without a country', () => {
      expect(geo_key({ country: null, region: 'CA' })).toBeNull()
    })
  })
}
