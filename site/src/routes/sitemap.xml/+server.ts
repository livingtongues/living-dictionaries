import type { RequestHandler } from './$types'
import { get_shared_db } from '$lib/db/server/shared-db'
import { SITEMAP_CACHE_CONTROL, xml_escape } from '$lib/server/sitemap-helpers'

/**
 * Sitemap INDEX — one child sitemap per public dictionary (generated on request
 * from its dict.db by `/sitemaps/[dict_id].xml`) plus a small static child for the
 * top-level pages. This is what opens the whole entry corpus to crawlers: the
 * dictionaries list and entry lists are client-rendered by design (server stays
 * light), so the sitemap is the crawl path to every entry page.
 *
 * Cached a week (`s-maxage`) so Cloudflare absorbs crawler traffic.
 */
export const GET: RequestHandler = ({ url }) => {
  const dictionaries = get_shared_db()
    .prepare('SELECT id FROM dictionaries WHERE public = 1 ORDER BY id')
    .all() as { id: string }[]

  const children = ['site', ...dictionaries.map(({ id }) => id)]
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children.map(child => `  <sitemap><loc>${xml_escape(`${url.origin}/sitemaps/${encodeURIComponent(child)}.xml`)}</loc></sitemap>`).join('\n')}
</sitemapindex>
`
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': SITEMAP_CACHE_CONTROL,
    },
  })
}
