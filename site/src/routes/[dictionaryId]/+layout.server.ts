import { redirect } from '@sveltejs/kit'
import type { Tables } from '$lib/types'
import type { LayoutServerLoad } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_user_dict_role } from '$lib/db/server/get-dictionary-role'
import { build_canonical_path } from './canonical-path'

/**
 * M4 · SSR-resolve the dictionary catalog row from `shared.db` (better-sqlite3,
 * server-only) by url-slug first, then id. Replaces the M1 stub lookup in
 * `+layout.ts`. Unknown slug → 301 home (matches the legacy behavior). The
 * per-dictionary content (entries, info, editors) still loads via the stub in
 * `+layout.ts` for now — converted incrementally in later M4 phases.
 *
 * Re-runs only when `params.dictionaryId` changes (dict→dict nav) or on
 * `invalidateAll()` — NOT on within-dict navigation. Catalog edits refresh it
 * indirectly: `+layout.ts` depends on DICTIONARY_UPDATED_LOAD_TRIGGER and
 * `await parent()`s this server load, which drags it along on a re-run.
 *
 * Also SSR-resolves this user's role grant (`ssr_role`) from shared.db so
 * `+layout.ts` can compute `is_editor_or_above` / `can_edit` on a hard load —
 * the browser `dict_roles` cache is empty during SSR, so without this a
 * non-admin editor/manager 403s on refresh of editor-gated pages (e.g. history).
 */
export const load: LayoutServerLoad = async ({ params: { dictionaryId: dictionary_url }, parent, url }) => {
  const dictionary = get_dictionary_by_url_or_id(dictionary_url)
  if (!dictionary)
    redirect(ResponseCodes.MOVED_PERMANENTLY, '/')

  // Canonicalize: reached via the legacy id (or a stale url) → 301 to the
  // canonical url slug, path + query preserved. `encodeURIComponent` matters —
  // legacy ids contain characters that cannot go into a Location header.
  if (dictionary.url && dictionary_url !== dictionary.url)
    redirect(ResponseCodes.MOVED_PERMANENTLY, build_canonical_path({ pathname: url.pathname, search: url.search, canonical_url: dictionary.url }))

  const { ssr_user } = await parent()
  const ssr_role = ssr_user ? get_user_dict_role({ dictionary_id: dictionary.id, user_id: ssr_user.id }) : null

  return { dictionary: dictionary as unknown as Tables<'dictionaries'>, ssr_role }
}
