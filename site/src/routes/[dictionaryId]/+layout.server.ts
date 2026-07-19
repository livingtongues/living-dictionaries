import { error, redirect } from '@sveltejs/kit'
import type { Tables } from '$lib/types'
import type { LayoutServerLoad } from './$types'
import { DICTIONARY_UPDATED_LOAD_TRIGGER, ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_user_dict_role } from '$lib/db/server/get-dictionary-role'
import { can_access_secure_dictionary, is_secure_dictionary } from '$lib/db/server/secure-dictionary'
import { about_has_meaningful_content } from '$lib/markdown/about-content'
import { build_canonical_path } from './canonical-path'

/**
 * M4 · SSR-resolve the dictionary catalog row from `shared.db` (better-sqlite3,
 * server-only) by url-slug first, then id. Replaces the M1 stub lookup in
 * `+layout.ts`. Unknown slugs return a genuine 404. The
 * per-dictionary content (entries, info, editors) still loads via the stub in
 * `+layout.ts` for now — converted incrementally in later M4 phases.
 *
 * Re-runs when `params.dictionaryId` changes (dict→dict nav), on
 * `invalidateAll()`, or on `invalidate(DICTIONARY_UPDATED_LOAD_TRIGGER)` — NOT
 * on within-dict navigation. The trigger MUST be registered HERE (not just in
 * `+layout.ts`): a universal load's `depends` doesn't drag its server parent
 * along on invalidate, so without this the client re-runs `+layout.ts` against
 * a CACHED catalog row and edits never appear until a hard reload.
 *
 * Also SSR-resolves this user's role grant (`ssr_role`) from shared.db so
 * `+layout.ts` can compute `is_manager` / `can_edit` on a hard load — the
 * browser `dict_roles` cache is empty during SSR, so without this a non-admin
 * manager 403s on refresh of manager-gated pages (e.g. history).
 */
export const load: LayoutServerLoad = async ({ params: { dictionaryId: dictionary_url }, parent, url, depends }) => {
  depends(DICTIONARY_UPDATED_LOAD_TRIGGER)
  const dictionary = get_dictionary_by_url_or_id(dictionary_url)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'Not found')

  const { ssr_user } = await parent()
  const ssr_role = ssr_user ? get_user_dict_role({ dictionary_id: dictionary.id, user_id: ssr_user.id }) : null

  // Secure dictionary (`bucket = 'secure'`): only direct role holders and
  // level-3 admins may pass — everyone else gets the exact unknown-slug
  // 404, BEFORE the canonicalize 301 below (which would itself confirm the
  // dictionary exists). Zero cost on the hot path: bucket rides on the row we
  // already fetched, ssr_role and admin_level are already resolved.
  if (is_secure_dictionary(dictionary) && !can_access_secure_dictionary({ role: ssr_role, admin_level: ssr_user?.admin_level ?? 0 }))
    error(ResponseCodes.NOT_FOUND, 'Not found')

  // Canonicalize: reached via the legacy id (or a stale url) → 301 to the
  // canonical url slug, path + query preserved. `encodeURIComponent` matters —
  // legacy ids contain characters that cannot go into a Location header.
  if (dictionary.url && dictionary_url !== dictionary.url)
    redirect(ResponseCodes.MOVED_PERMANENTLY, build_canonical_path({ pathname: url.pathname, search: url.search, canonical_url: dictionary.url }))

  return {
    dictionary: dictionary as unknown as Tables<'dictionaries'>,
    ssr_role,
    about_is_complete: about_has_meaningful_content(dictionary.about),
  }
}
