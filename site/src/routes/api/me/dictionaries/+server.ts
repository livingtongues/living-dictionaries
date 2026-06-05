import type { DictionaryView } from '$lib/types'
import type { RequestHandler } from './$types'
import { verify_auth } from '$lib/auth/verify'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_dictionaries_for_user } from '$lib/db/server/get-dictionaries-catalog'
import { json } from '@sveltejs/kit'

export interface MyDictionariesResponseBody {
  dictionaries: (DictionaryView & { role: string })[]
}

/**
 * GET /api/me/dictionaries — full `DictionaryView` rows (from `shared.db`) for
 * every dictionary the caller holds a `dictionary_roles` grant on, plus their
 * `role`. Backs the homepage "My Dictionaries" globe overlay + list.
 */
export const GET: RequestHandler = async (event) => {
  const { user_id } = await verify_auth(event)
  const dictionaries = load_dictionaries_for_user({ db: get_shared_db(), user_id })
  return json({ dictionaries } satisfies MyDictionariesResponseBody)
}
