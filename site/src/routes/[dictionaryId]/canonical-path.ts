/**
 * Rebuild a `/[dictionaryId]/...` pathname with the first segment swapped for
 * the dictionary's canonical url slug (encoded — slugs are enforced ASCII for
 * new dicts, but legacy ids/urls may contain characters that cannot appear in
 * a Location header).
 */
export function build_canonical_path({ pathname, search, canonical_url }: { pathname: string, search: string, canonical_url: string }) {
  const rest_start = pathname.indexOf('/', 1)
  const rest = rest_start === -1 ? '' : pathname.slice(rest_start)
  return `/${encodeURIComponent(canonical_url)}${rest}${search}`
}

if (import.meta.vitest) {
  describe(build_canonical_path, () => {
    test('swaps the dict segment and keeps the rest of the path', () => {
      expect(build_canonical_path({ pathname: '/ng%C9%99mba/entry/abc', search: '', canonical_url: 'ngemba' }))
        .toBe('/ngemba/entry/abc')
    })

    test('bare dictionary path', () => {
      expect(build_canonical_path({ pathname: '/ng%C9%99mba', search: '', canonical_url: 'ngemba' }))
        .toBe('/ngemba')
    })

    test('preserves the query string', () => {
      expect(build_canonical_path({ pathname: '/80CcDQ4DRyiYSPIWZ9Hy/entries', search: '?q=%7B%22page%22%3A2%7D', canonical_url: 'aonekko' }))
        .toBe('/aonekko/entries?q=%7B%22page%22%3A2%7D')
    })

    test('encodes a legacy non-ascii canonical url instead of crashing', () => {
      expect(build_canonical_path({ pathname: '/some-id/about', search: '', canonical_url: 'ngəmba' }))
        .toBe('/ng%C9%99mba/about')
    })
  })
}
