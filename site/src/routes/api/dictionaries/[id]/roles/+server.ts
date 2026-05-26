import type { RequestHandler } from './$types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

/**
 * Manager-scoped REST endpoints for `dictionary_roles` (Story A.3).
 *
 * Site admins (`admin_level >= 1`) AND dictionary managers (`role = 'manager'`
 * on this dict) both pass the gate. Both write directly to shared.db with no
 * sync — these are low-frequency settings-page actions; the admin.db sync
 * engine still pulls them down on the next admin sync, and managers don't
 * have a local mirror at all.
 *
 * POST folds two operations into one:
 *   - If `target_email` resolves to an existing `users.email` → INSERT into
 *     `dictionary_roles`.
 *   - Else → INSERT into `invites` with `status = 'queued'`. The L4 mailer
 *     will pick it up; on claim the invite becomes a real role row.
 */

export interface DictionariesIdRolesGetResponseBody {
  roles: {
    id: string
    user_id: string
    user_email: string | null
    user_name: string | null
    role: 'manager' | 'editor' | 'contributor'
    invited_by_user_id: string | null
    created_at: string
  }[]
  invites: {
    id: string
    target_email: string
    role: 'manager' | 'editor' | 'contributor'
    status: 'queued' | 'sent' | 'claimed' | 'cancelled'
    created_at: string
  }[]
}

export const GET: RequestHandler = async (event) => {
  const dict_id = event.params.id
  if (!dict_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id')

  await verify_auth_dict_role(event, dict_id, 'manager')

  const db = get_shared_db()
  const roles = db.prepare(`
    SELECT
      dictionary_roles.id                 AS id,
      dictionary_roles.user_id            AS user_id,
      users.email                         AS user_email,
      users.name                          AS user_name,
      dictionary_roles.role               AS role,
      dictionary_roles.invited_by_user_id AS invited_by_user_id,
      dictionary_roles.created_at         AS created_at
    FROM dictionary_roles
    LEFT JOIN users ON users.id = dictionary_roles.user_id
    WHERE dictionary_roles.dictionary_id = ?
    ORDER BY dictionary_roles.created_at ASC
  `).all(dict_id) as DictionariesIdRolesGetResponseBody['roles']

  const invites = db.prepare(`
    SELECT id, target_email, role, status, created_at
    FROM invites
    WHERE dictionary_id = ? AND status IN ('queued', 'sent')
    ORDER BY created_at ASC
  `).all(dict_id) as DictionariesIdRolesGetResponseBody['invites']

  return json({ roles, invites } satisfies DictionariesIdRolesGetResponseBody)
}

export interface DictionariesIdRolesPostRequestBody {
  target_email: string
  role: 'manager' | 'editor' | 'contributor'
}

export interface DictionariesIdRolesPostResponseBody {
  result: 'role_created' | 'invite_created'
  role_id?: string
  invite_id?: string
}

const VALID_ROLES = new Set(['manager', 'editor', 'contributor'])

export const POST: RequestHandler = async (event) => {
  const dict_id = event.params.id
  if (!dict_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id')

  const auth = await verify_auth_dict_role(event, dict_id, 'manager')
  if (!auth.email)
    error(ResponseCodes.BAD_REQUEST, 'inviter must have an email on file')

  const body = await event.request.json() as DictionariesIdRolesPostRequestBody
  const target_email = (body.target_email || '').trim().toLowerCase()
  const { role } = body

  if (!target_email)
    error(ResponseCodes.BAD_REQUEST, 'target_email required')
  if (!VALID_ROLES.has(role))
    error(ResponseCodes.BAD_REQUEST, `invalid role: ${role}`)

  const db = get_shared_db()

  // Resolve target user. `users.email` and `email_aliases.email` are both
  // COLLATE NOCASE; the lowercase compare here is belt-and-suspenders.
  const target_user = db.prepare(`
    SELECT id FROM users WHERE email = ?
    UNION
    SELECT user_id AS id FROM email_aliases WHERE email = ?
    LIMIT 1
  `).get(target_email, target_email) as { id: string } | undefined

  const now = new Date().toISOString()

  if (target_user) {
    // INSERT or upgrade existing role row. UNIQUE is (dictionary_id, user_id, role)
    // so re-issuing the same role is a no-op.
    const role_id = crypto.randomUUID()
    db.prepare(`
      INSERT INTO dictionary_roles
        (id, dictionary_id, user_id, role, invited_by_user_id, dirty, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT (dictionary_id, user_id, role) DO UPDATE SET
        invited_by_user_id = excluded.invited_by_user_id,
        dirty              = 1,
        updated_at         = excluded.updated_at
    `).run(role_id, dict_id, target_user.id, role, auth.user_id, now, now)
    return json({ result: 'role_created', role_id } satisfies DictionariesIdRolesPostResponseBody)
  }

  // No matching user — queue an invite. L4 mailer will pick it up.
  const invite_id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO invites
      (id, dictionary_id, inviter_user_id, inviter_email, target_email, role, status, dirty, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', 1, ?, ?)
  `).run(invite_id, dict_id, auth.user_id, auth.email, target_email, role, now, now)
  return json({ result: 'invite_created', invite_id } satisfies DictionariesIdRolesPostResponseBody)
}
