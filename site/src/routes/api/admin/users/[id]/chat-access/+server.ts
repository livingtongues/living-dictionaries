import type { RequestHandler } from './$types'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

/**
 * Admin control to grant/revoke a user's chat access (`users.chat_access`).
 * A chat member = admin (level >= 2) OR chat_access OR member of >= 1 room; any
 * chat member can DM/see any other. This is the durable way to admit someone
 * (e.g. a super manager) to /chat without first adding them to a channel.
 * SITE-ADMIN ONLY.
 *
 * Writes shared.db directly and bumps `updated_at` so admin clients pull the
 * change on next sync (`users` is download-only client-side).
 */

export interface AdminUserChatAccessRequestBody {
  chat_access: boolean
}

export interface AdminUserChatAccessResponseBody {
  result: 'success'
  chat_access: boolean
}

export const POST: RequestHandler = async (event) => {
  const user_id = event.params.id
  if (!user_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing user id')

  const { email } = await verify_auth(event)
  if (!is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const body = await event.request.json() as AdminUserChatAccessRequestBody
  if (typeof body.chat_access !== 'boolean')
    error(ResponseCodes.BAD_REQUEST, 'chat_access (boolean) required')

  const db = get_shared_db()
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id) as { id: string } | undefined
  if (!existing)
    error(ResponseCodes.NOT_FOUND, 'User not found')

  const now = new Date().toISOString()
  db.prepare('UPDATE users SET chat_access = ?, updated_at = ? WHERE id = ?')
    .run(body.chat_access ? 1 : 0, now, user_id)

  return json({ result: 'success', chat_access: body.chat_access } satisfies AdminUserChatAccessResponseBody)
}
