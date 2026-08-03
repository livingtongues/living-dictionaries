/**
 * Sub-paths of a dictionary that USED to exist and are still linked from papers,
 * emails and search results. Measured against 60 days of production 404s on
 * dictionaries that still exist: `synopsis` alone was 127 of them, far and away
 * the most-hit dead URL on the site (.issues/not-found-page-is-a-scary-error.md).
 *
 * Anything not listed here is a genuine 404 — we do NOT guess.
 */
const LEGACY_PATH_TARGETS: Record<string, string> = {
  synopsis: '',
  overview: '',
  search: '/entries',
}

/**
 * The canonical path a legacy dictionary sub-path should 301 to, or null when
 * the path is genuinely unknown. `dictionary_url` is whatever slug the visitor
 * used — the dictionary layout canonicalizes a legacy id on the next request.
 */
export function legacy_dictionary_path({ dictionary_url, unmatched, search = '' }: { dictionary_url: string, unmatched: string, search?: string }): string | null {
  const path = unmatched.replace(/\/+$/, '').toLowerCase()
  const target = LEGACY_PATH_TARGETS[path]
  if (target === undefined)
    return null
  return `/${encodeURIComponent(dictionary_url)}${target}${search}`
}

if (import.meta.vitest) {
  describe(legacy_dictionary_path, () => {
    test('the big one: /{dict}/synopsis → dictionary home', () => {
      expect(legacy_dictionary_path({ dictionary_url: 'birhor', unmatched: 'synopsis' })).toBe('/birhor')
    })

    test('overview is the same page under its older name', () => {
      expect(legacy_dictionary_path({ dictionary_url: 'mapudungun', unmatched: 'overview' })).toBe('/mapudungun')
    })

    test('search became the entries list', () => {
      expect(legacy_dictionary_path({ dictionary_url: 'babanki', unmatched: 'search' })).toBe('/babanki/entries')
    })

    test('keeps the query string so campaign links survive', () => {
      expect(legacy_dictionary_path({ dictionary_url: 'babanki', unmatched: 'search', search: '?q=abc' })).toBe('/babanki/entries?q=abc')
    })

    test('encodes a legacy non-ascii slug instead of emitting a bad Location', () => {
      expect(legacy_dictionary_path({ dictionary_url: 'ngəmba', unmatched: 'synopsis' })).toBe('/ng%C9%99mba')
    })

    test('tolerates a trailing slash and odd casing', () => {
      expect(legacy_dictionary_path({ dictionary_url: 'birhor', unmatched: 'Synopsis/' })).toBe('/birhor')
    })

    test('an unknown sub-path is a real 404, not a guess', () => {
      expect(legacy_dictionary_path({ dictionary_url: 'birhor', unmatched: 'osk/kmwosk.css' })).toBe(null)
      expect(legacy_dictionary_path({ dictionary_url: 'birhor', unmatched: 'entrie' })).toBe(null)
    })
  })
}
