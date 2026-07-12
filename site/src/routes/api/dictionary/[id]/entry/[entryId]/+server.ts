import type { RequestHandler } from './$types'
import type { EntryData } from '$lib/types'
import { error, json } from '@sveltejs/kit'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { build_entry_data } from '$lib/db/server/build-entry-data'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_user_dict_role } from '$lib/db/server/get-dictionary-role'
import { can_access_secure_dictionary, is_secure_dictionary } from '$lib/db/server/secure-dictionary'
import { get_shared_db } from '$lib/db/server/shared-db'
import { get_effective_admin_level } from '$lib/server/effective-admin-level'

export interface DictionaryEntryResponseBody {
  entry: EntryData | null
}

/**
 * GET /api/dictionary/[id]/entry/[entryId]
 *
 * Server-rendered single entry for the reader's universal `+page.ts` — read
 * from the per-dict better-sqlite3 DB so a shared entry URL resolves real
 * content + OG meta on first paint (SSR) and during the cold warm-up window,
 * without forcing the whole dict.db snapshot to load first.
 *
 * Public + soft-auth: the reader is anonymous-reachable; we only resolve the
 * session to widen private/`v4` tag visibility for admins so their SSR matches
 * their warm client build. Anonymous never 401s. `{ entry: null }` (200) when
 * the entry id doesn't exist — the load turns that into a 404. Secure
 * dictionaries: members/admin-3 only — everyone else gets the unknown-dict 404.
 */
export const GET: RequestHandler = async (event) => {
  const dict_id_or_url = event.params.id
  const entry_id = event.params.entryId
  if (!dict_id_or_url || !entry_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id or entry id')

  // Resolve url-slug → canonical id (LD dicts can have url !== id) so the
  // dict.db file keys correctly.
  const dictionary = get_dictionary_by_url_or_id(dict_id_or_url)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')

  let admin_level = 0
  let user_id: string | null = null
  try {
    const auth = await verify_auth(event)
    ;({ user_id } = auth)
    admin_level = get_effective_admin_level({ db: get_shared_db(), user_id: auth.user_id, email: auth.email, cookies: event.cookies })
  } catch {
    /* anonymous reader — public tags only */
  }

  // Secure dictionary: members + level-3 admins only; everyone else gets the
  // same 404 as an unknown dictionary id.
  if (is_secure_dictionary(dictionary)) {
    const role = user_id ? get_user_dict_role({ dictionary_id: dictionary.id, user_id }) : null
    if (!can_access_secure_dictionary({ role, admin_level }))
      error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  }

  const db = get_dictionary_db(dictionary.id)
  const entry = build_entry_data({ db, entry_id, admin_level })
  return json({ entry } satisfies DictionaryEntryResponseBody)
}
