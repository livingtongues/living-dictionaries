/** Shared bits for the sitemap index + child sitemap routes. */

/** ~1h browser / 1 week edge (Cloudflare) — sitemaps only need weekly freshness. */
export const SITEMAP_CACHE_CONTROL = 'public, max-age=3600, s-maxage=604800'

/** The 5 XML special characters — sitemap <loc> values must be XML-escaped. */
export function xml_escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}

export function urlset({ urls }: { urls: { loc: string, lastmod?: string }[] }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ loc, lastmod }) => `  <url><loc>${xml_escape(loc)}</loc>${lastmod ? `<lastmod>${xml_escape(lastmod)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`
}

if (import.meta.vitest) {
  test('xml_escape', () => {
    expect(xml_escape('https://x.app/a?b=1&c=2')).toBe('https://x.app/a?b=1&amp;c=2')
  })

  test('urlset', () => {
    expect(urlset({ urls: [{ loc: 'https://x.app/a', lastmod: '2026-01-01' }, { loc: 'https://x.app/b' }] }))
      .toContain('<url><loc>https://x.app/a</loc><lastmod>2026-01-01</lastmod></url>')
  })
}
