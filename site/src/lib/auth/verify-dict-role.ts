import type { Cookies } from '@sveltejs/kit'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { is_secure_dictionary, SECURE_DICT_ADMIN_LEVEL } from '$lib/db/server/secure-dictionary'
import { get_effective_admin_level } from '$lib/server/effective-admin-level'
import { error } from '@sveltejs/kit'
import { verify_auth } from './verify'

const ROLE_RANK = { contributor: 1, editor: 2, manager: 3 } as const
type Role = keyof typeof ROLE_RANK
/** The human per-dictionary roles, weakest → strongest. */
export type DictRole = Role

/**
 * Verify the caller has at least `min_role` on the given dictionary.
 *
 * Site admins + super managers (`admin_level >= 1`) bypass the per-dict role
 * check entirely. The fresh DB lookup on every push ensures revocations are
 * immediate (per Story B.5 — JWTs would let revoked editors keep pushing for
 * up to 30 days until their token expires).
 *
 * `admin_level` is derived per-request: the `$lib/admins.ts` allow-list by
 * email (levels 2/3) plus the user's `users.roles` row (super_manager →
 * level 1) — never baked into the JWT, so granting/revoking is immediate.
 *
 * SECURE dictionaries (`bucket = 'secure'`, see `secure-dictionary.ts`): the
 * admin bypass tightens to level 3 (a level-1/2 admin holding a direct grant
 * still passes via the grant), and callers with no session or no grant get
 * 404 `dictionary not found` — indistinguishable from a nonexistent dict.
 * A member whose RANK is merely insufficient keeps the normal 403 (they can
 * already see the dictionary).
 */
export async function verify_auth_dict_role(event: {
  request: Request
  cookies?: Pick<Cookies, 'get'>
}, { dictionary, min_role = 'editor' }: {
  dictionary: { id: string, bucket?: string | null }
  min_role?: Role
}): Promise<{ user_id: string, email: string | undefined, name: string | undefined, admin_level: number, role: Role | 'admin' }> {
  const is_secure = is_secure_dictionary(dictionary)

  let auth: Awaited<ReturnType<typeof verify_auth>>
  try {
    auth = await verify_auth(event)
  } catch (err) {
    if (is_secure)
      error(ResponseCodes.NOT_FOUND, 'dictionary not found')
    throw err
  }

  const db = get_shared_db()
  const admin_level = get_effective_admin_level({ db, user_id: auth.user_id, email: auth.email, cookies: event.cookies })
  if (admin_level >= (is_secure ? SECURE_DICT_ADMIN_LEVEL : 1))
    return { ...auth, admin_level, role: 'admin' }

  const row = db.prepare(
    `SELECT role FROM dictionary_roles
     WHERE dictionary_id = ? AND user_id = ?
     ORDER BY CASE role
       WHEN 'manager' THEN 1
       WHEN 'editor' THEN 2
       WHEN 'contributor' THEN 3
       ELSE 4 END
     LIMIT 1`,
  ).get(dictionary.id, auth.user_id) as { role: Role } | undefined
  if (!row) {
    if (is_secure)
      error(ResponseCodes.NOT_FOUND, 'dictionary not found')
    error(ResponseCodes.FORBIDDEN, 'role_revoked')
  }

  if (ROLE_RANK[row.role] < ROLE_RANK[min_role])
    error(ResponseCodes.FORBIDDEN, `Requires ${min_role} role`)

  return { ...auth, admin_level, role: row.role }
}
