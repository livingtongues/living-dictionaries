import type { RequestHandler } from './$types'
import type { SiteRole } from '$lib/admins'
import { is_admin, SITE_ROLES } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

/**
 * Admin control to set a user's site-wide DB roles (`users.roles`) — today
 * just `super_manager` (effective admin level 1: dictionary-manager powers on
 * every dictionary, no /admin access). SITE-ADMIN ONLY.
 *
 * Full-set semantics: the body's `roles` array REPLACES the stored set (empty
 * array clears to NULL). Like the sibling name/unsubscribe endpoints this
 * writes shared.db directly and bumps `updated_at` so admin clients pull the
 * change on next sync (`users` is download-only client-side).
 */

export interface AdminUserRolesRequestBody {
  roles: SiteRole[]
}

export interface AdminUserRolesResponseBody {
  result: 'success'
  roles: SiteRole[] | null
}

export const POST: RequestHandler = async (event) => {
  const user_id = event.params.id
  if (!user_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing user id')

  const { email } = await verify_auth(event)
  if (!is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const body = await event.request.json() as AdminUserRolesRequestBody
  if (!Array.isArray(body.roles))
    error(ResponseCodes.BAD_REQUEST, 'roles (array) required')
  for (const role of body.roles) {
    if (!SITE_ROLES.includes(role))
      error(ResponseCodes.BAD_REQUEST, `Unknown role: ${role}`)
  }

  const db = get_shared_db()
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id) as { id: string } | undefined
  if (!existing)
    error(ResponseCodes.NOT_FOUND, 'User not found')

  const deduped = [...new Set(body.roles)]
  const roles = deduped.length ? deduped : null
  const now = new Date().toISOString()
  db.prepare('UPDATE users SET roles = ?, updated_at = ? WHERE id = ?')
    .run(roles ? JSON.stringify(roles) : null, now, user_id)

  return json({ result: 'success', roles } satisfies AdminUserRolesResponseBody)
}
