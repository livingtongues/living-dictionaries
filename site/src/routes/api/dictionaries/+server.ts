import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { DictionaryView } from '$lib/types'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_all_dictionaries, load_private_dictionaries, load_public_dictionaries } from '$lib/db/server/get-dictionaries-catalog'
import { get_effective_admin_level } from '$lib/server/effective-admin-level'

export interface DictionariesResponseBody {
  dictionaries: DictionaryView[]
}

/**
 * M4 catalog read endpoint. Serves the dictionary catalog from `shared.db`
 * (better-sqlite3, server-only) so the browser globe / list / footer get real
 * data without bundling the native driver. Replaces the M1 stub reads of
 * `materialized_dictionaries_view`.
 *
 * `?visibility=public` (default) | `private` | `all`. Private/all require
 * effective admin level >= 1 (admins + super managers) — anonymous or regular
 * users get a 403 rather than the private catalog.
 */
export const GET: RequestHandler = async (event) => {
  const db = get_shared_db()
  const visibility = event.url.searchParams.get('visibility') || 'public'

  if (visibility !== 'public') {
    const { user_id, email } = await verify_auth(event)
    const admin_level = get_effective_admin_level({ db, user_id, email, cookies: event.cookies })
    if (admin_level < 1)
      error(ResponseCodes.FORBIDDEN, 'Admin or super manager only')
  }

  const dictionaries = visibility === 'all'
    ? load_all_dictionaries({ db })
    : visibility === 'private'
      ? load_private_dictionaries({ db })
      : load_public_dictionaries({ db })

  return json({ dictionaries } satisfies DictionariesResponseBody)
}
