import { existsSync } from 'node:fs'
import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { dictionary_db_path, get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_shared_db } from '$lib/db/server/shared-db'
import { SITEMAP_CACHE_CONTROL, urlset } from '$lib/server/sitemap-helpers'

/**
 * Child sitemap for one public dictionary (listed by the `/sitemap.xml` index):
 * `/{url}` (the dictionary home), `/{url}/entries`, `/{url}/about`, `/{url}/grammar` (when grammar content exists)
 * and every `/{url}/entry/{id}` from the dictionary's dict.db. The special id
 * `site` yields the static top-level pages.
 *
 * Deletion is HARD in dict.db (rows go to `deletes`), so every `entries` row is a
 * live page. Capped at the sitemap-protocol 50k-URL limit; `existsSync` guard
 * because `get_dictionary_db` CREATES missing files (same pattern as dict home).
 */

const SITEMAP_URL_LIMIT = 49_000

/** `lastmod` must be W3C datetime — stored timestamps vary, the date part is enough. */
function to_lastmod(timestamp: string | null | undefined): string | undefined {
  const date = timestamp?.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : undefined
}

export const GET: RequestHandler = ({ params, url: request_url }) => {
  const { origin } = request_url

  if (params.dict_id === 'site') {
    return xml_response(urlset({
      urls: ['/', '/about', '/dictionaries', '/tutorials'].map(path => ({ loc: `${origin}${path}` })),
    }))
  }

  const dictionary = get_shared_db()
    .prepare('SELECT id, url, grammar FROM dictionaries WHERE public = 1 AND id = ?')
    .get(params.dict_id) as { id: string, url: string | null, grammar: string | null } | undefined
  if (!dictionary)
    error(404, 'Not found')

  const slug = encodeURIComponent(dictionary.url || dictionary.id)
  const urls: { loc: string, lastmod?: string }[] = [
    { loc: `${origin}/${slug}` },
    { loc: `${origin}/${slug}/entries` },
    { loc: `${origin}/${slug}/about` },
    ...dictionary.grammar ? [{ loc: `${origin}/${slug}/grammar` }] : [],
  ]

  if (existsSync(dictionary_db_path(dictionary.id))) {
    const entries = get_dictionary_db(dictionary.id)
      .prepare(`SELECT id, updated_at FROM entries ORDER BY id LIMIT ${SITEMAP_URL_LIMIT}`)
      .all() as { id: string, updated_at: string | null }[]
    for (const entry of entries)
      urls.push({ loc: `${origin}/${slug}/entry/${encodeURIComponent(entry.id)}`, lastmod: to_lastmod(entry.updated_at) })
  }

  return xml_response(urlset({ urls }))
}

function xml_response(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': SITEMAP_CACHE_CONTROL,
    },
  })
}
