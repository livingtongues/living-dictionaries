import { redirect } from '@sveltejs/kit'
import type { Tables } from '$lib/types'
import type { LayoutServerLoad } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'

/**
 * M4 · SSR-resolve the dictionary catalog row from `shared.db` (better-sqlite3,
 * server-only) by url-slug first, then id. Replaces the M1 stub lookup in
 * `+layout.ts`. Unknown slug → 301 home (matches the legacy behavior). The
 * per-dictionary content (entries, info, editors) still loads via the stub in
 * `+layout.ts` for now — converted incrementally in later M4 phases.
 */
export const load: LayoutServerLoad = ({ params: { dictionaryId: dictionary_url } }) => {
  const dictionary = get_dictionary_by_url_or_id(dictionary_url)
  if (!dictionary)
    redirect(ResponseCodes.MOVED_PERMANENTLY, '/')

  return { dictionary: dictionary as unknown as Tables<'dictionaries'> }
}
