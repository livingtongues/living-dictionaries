import type { RequestHandler } from './$types'
import type { EntryData } from '$lib/types'
import { error, json } from '@sveltejs/kit'
import { get_admin_level } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { build_entry_data } from '$lib/db/server/build-entry-data'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'

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
 * the entry id doesn't exist — the load turns that into a 404.
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
  try {
    const { email } = await verify_auth(event)
    admin_level = get_admin_level(email) ?? 0
  } catch {
    /* anonymous reader — public tags only */
  }

  const db = get_dictionary_db(dictionary.id)
  const entry = build_entry_data({ db, entry_id, admin_level })
  return json({ entry } satisfies DictionaryEntryResponseBody)
}
