import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_all_dictionaries, load_private_dictionaries, load_public_dictionaries } from '$lib/db/server/get-dictionaries-catalog'

/**
 * M4 catalog read endpoint. Serves the dictionary catalog from `shared.db`
 * (better-sqlite3, server-only) so the browser globe / list / footer get real
 * data without bundling the native driver. Replaces the M1 stub reads of
 * `materialized_dictionaries_view`.
 *
 * `?visibility=public` (default) | `private` | `all`. Private/all are only
 * meaningful for admins; access control rides on the page that calls this
 * (anonymous users only ever request `public`).
 */
export const GET: RequestHandler = ({ url }) => {
  const db = get_shared_db()
  const visibility = url.searchParams.get('visibility') || 'public'

  const dictionaries = visibility === 'all'
    ? load_all_dictionaries({ db })
    : visibility === 'private'
      ? load_private_dictionaries({ db })
      : load_public_dictionaries({ db })

  return json({ dictionaries })
}
