import { error, redirect } from '@sveltejs/kit'
import { legacy_dictionary_path } from './legacy-paths'
import { ResponseCodes } from '$lib/constants'

/**
 * Catch-all for sub-paths of a dictionary that match no route. Without it an
 * unmatched route never runs the dictionary layout, so an old link like
 * `/{dict}/synopsis` fell out to the bare site-wide error page — no dictionary
 * name, no way back in. Known legacy paths 301 to their modern home; everything
 * else 404s HERE, inside the dictionary, where `[dictionaryId]/+error.svelte`
 * renders it with the side menu and links back to the entries list.
 *
 * SvelteKit always prefers a more specific route, so this shadows nothing.
 */
export function load({ params, url }) {
  const target = legacy_dictionary_path({
    dictionary_url: params.dictionaryId,
    unmatched: params.unmatched,
    search: url.search,
  })
  if (target)
    redirect(ResponseCodes.MOVED_PERMANENTLY, target)

  error(ResponseCodes.NOT_FOUND, 'Page not found')
}
