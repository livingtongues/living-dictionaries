import type { RequestHandler } from './$types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

/**
 * DELETE /api/dictionaries/[id]/roles/[role_id]
 *
 * Revoke a role row. Manager (on this dict) or site admin only.
 *
 * Goes through the `deletes` tombstone table so the admin.db sync engine
 * picks up the revocation on next sync; otherwise admin clients would keep
 * showing the user as having the role.
 */
export interface DictionariesIdRolesRoleIdDeleteResponseBody {
  result: 'deleted'
}

export const DELETE: RequestHandler = async (event) => {
  const dict_id = event.params.id
  const { role_id } = event.params
  if (!dict_id || !role_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id or role id')

  await verify_auth_dict_role(event, dict_id, 'manager')

  const db = get_shared_db()

  // Defense-in-depth: ensure the role row actually belongs to this dict
  // before deletion (so a manager of dict A can't delete a role on dict B
  // by knowing its role_id).
  const row = db.prepare(
    `SELECT id FROM dictionary_roles WHERE id = ? AND dictionary_id = ?`,
  ).get(role_id, dict_id) as { id: string } | undefined
  if (!row)
    error(ResponseCodes.NOT_FOUND, 'role not found on this dictionary')

  const now = new Date().toISOString()
  // Insert tombstone — the `process_delete_cascade` trigger removes the
  // actual row from `dictionary_roles`. Admin clients pull this on next sync.
  db.prepare(`
    INSERT OR REPLACE INTO deletes (table_name, id, updated_at)
    VALUES ('dictionary_roles', ?, ?)
  `).run(role_id, now)

  return json({ result: 'deleted' } satisfies DictionariesIdRolesRoleIdDeleteResponseBody)
}
