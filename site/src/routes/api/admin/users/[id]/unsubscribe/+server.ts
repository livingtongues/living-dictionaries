import type { RequestHandler } from './$types'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

/**
 * Admin toggle for a user's email-unsubscribe flag. SITE-ADMIN ONLY.
 *
 * Needed because the `users` table is download-only on admin clients (no
 * `dirty` column; in READONLY_TABLES) — a local live-db `_save()` would never
 * sync up. This writes `users.unsubscribed_from_emails` directly to shared.db
 * and bumps `updated_at` so the admin client pulls the change on next sync.
 */

export interface AdminUserUnsubscribeRequestBody {
  unsubscribed: boolean
}

export interface AdminUserUnsubscribeResponseBody {
  result: 'success'
  unsubscribed_from_emails: string | null
}

export const POST: RequestHandler = async (event) => {
  const user_id = event.params.id
  if (!user_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing user id')

  const { email } = await verify_auth(event)
  if (!is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const body = await event.request.json() as AdminUserUnsubscribeRequestBody
  if (typeof body.unsubscribed !== 'boolean')
    error(ResponseCodes.BAD_REQUEST, 'unsubscribed (boolean) required')

  const db = get_shared_db()
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id) as { id: string } | undefined
  if (!existing)
    error(ResponseCodes.NOT_FOUND, 'User not found')

  const now = new Date().toISOString()
  const value = body.unsubscribed ? now : null
  db.prepare(`UPDATE users SET unsubscribed_from_emails = ?, updated_at = ? WHERE id = ?`).run(value, now, user_id)

  return json({ result: 'success', unsubscribed_from_emails: value } satisfies AdminUserUnsubscribeResponseBody)
}
