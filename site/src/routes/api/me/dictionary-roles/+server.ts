import type { RequestHandler } from './$types'
import { verify_auth } from '$lib/auth/verify'
import { get_shared_db } from '$lib/db/server/shared-db'
import { json } from '@sveltejs/kit'

/**
 * GET /api/me/dictionary-roles
 *
 * Returns every `dictionary_roles` row for the caller, joined with the
 * dictionary's display name. Story B.6 in `.issues/port-db-sync-architecture.md`.
 *
 * Site admins (`admin_level >= 1`) get only their actual `dictionary_roles`
 * grants — NOT every dict in the system. Site-wide admin access is a separate
 * concept exposed via `admin.db`; this endpoint reflects "things I'm
 * editorially responsible for" cleanly.
 *
 * Client caches the response in a `PersistedState` (localStorage), refreshes
 * on app boot if stale > 1 hour, on manual refresh, on login, on logout.
 * Stale-cache trade-off (admin grants a new role mid-session): the dict is
 * still URL-reachable + push endpoint does a fresh role lookup (B.5) so
 * security is unaffected; the cache just hasn't surfaced the new badge yet.
 */
export interface MyDictionaryRolesResponseBody {
  fetched_at: string
  roles: {
    dictionary_id: string
    dictionary_name: string
    role: 'manager' | 'editor' | 'contributor'
    granted_at: string
  }[]
}

export const GET: RequestHandler = async (event) => {
  const { user_id } = await verify_auth(event)
  const db = get_shared_db()

  const rows = db.prepare(`
    SELECT
      dictionary_roles.dictionary_id  AS dictionary_id,
      dictionaries.name               AS dictionary_name,
      dictionary_roles.role           AS role,
      dictionary_roles.created_at     AS granted_at
    FROM dictionary_roles
    INNER JOIN dictionaries ON dictionaries.id = dictionary_roles.dictionary_id
    WHERE dictionary_roles.user_id = ?
    ORDER BY dictionary_roles.created_at DESC
  `).all(user_id) as MyDictionaryRolesResponseBody['roles']

  return json({
    fetched_at: new Date().toISOString(),
    roles: rows,
  } satisfies MyDictionaryRolesResponseBody)
}
