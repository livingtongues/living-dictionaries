import { existsSync } from 'node:fs'
import type { RequestHandler } from './$types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_dictionary_history_db, history_db_path } from '$lib/db/server/dictionary-history-db'
import { query_history } from '$lib/db/server/dictionary-history-query'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

/**
 * GET /api/dictionary/[id]/history
 *
 * Read a record's change timeline (or the dictionary-wide feed). Server-only
 * audit log; **editors / managers / site-admins only** (contributors + anon
 * are rejected — history can include private content).
 *
 * Query params:
 *   ?owner_type=entry|text|sentence & owner_id=…  → that record's timeline
 *   ?feed=1                                       → dictionary-wide recent feed
 *   ?before=<rowid> & limit=<n>                   → keyset pagination
 */
export const GET: RequestHandler = async (event) => {
  const dict_id_or_url = event.params.id
  if (!dict_id_or_url)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id')

  const dictionary = get_dictionary_by_url_or_id(dict_id_or_url)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  const dict_id = dictionary.id

  // Hard gate: editor rank or above (manager/admin included), else 401/403.
  await verify_auth_dict_role(event, dict_id, 'editor')

  const params = event.url.searchParams
  const before_raw = params.get('before')
  const limit_raw = params.get('limit')

  // No edits recorded yet → empty timeline (don't create the file on a read).
  if (!existsSync(history_db_path(dict_id)))
    return json({ changes: [], users: {}, cursor: null })

  const result = query_history(get_dictionary_history_db(dict_id), get_shared_db(), {
    owner_type: params.get('owner_type') ?? undefined,
    owner_id: params.get('owner_id') ?? undefined,
    feed: params.get('feed') === '1' || params.get('feed') === 'true',
    before: before_raw ? Number(before_raw) : undefined,
    limit: limit_raw ? Number(limit_raw) : undefined,
  })

  return json(result)
}
