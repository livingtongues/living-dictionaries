import type { RequestHandler } from './$types'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

/**
 * Admin control to edit a user's display name. SITE-ADMIN ONLY.
 *
 * Needed because the `users` table is download-only on admin clients (no
 * `dirty` column; in READONLY_TABLES) — a local live-db `_save()` would never
 * sync up. This writes `users.name` directly to shared.db and bumps
 * `updated_at` so the admin client pulls the change on next sync.
 */

export interface AdminUserNameRequestBody {
  name: string
}

export interface AdminUserNameResponseBody {
  result: 'success'
  name: string | null
}

const NAME_MAX_LENGTH = 80
// Reject ASCII C0 controls (U+0000..U+001F) and DEL (U+007F). Built via
// String.fromCharCode + new RegExp so this source file stays as pure ASCII.
// eslint-disable-next-line regexp/no-obscure-range
const CONTROL_CHARS = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`)

export const POST: RequestHandler = async (event) => {
  const user_id = event.params.id
  if (!user_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing user id')

  const { email } = await verify_auth(event)
  if (!is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const body = await event.request.json() as AdminUserNameRequestBody
  if (typeof body.name !== 'string')
    error(ResponseCodes.BAD_REQUEST, 'name (string) required')

  const trimmed = body.name.trim()
  if (trimmed.length > NAME_MAX_LENGTH)
    error(ResponseCodes.BAD_REQUEST, `Name must be ${NAME_MAX_LENGTH} characters or fewer`)
  if (CONTROL_CHARS.test(trimmed))
    error(ResponseCodes.BAD_REQUEST, 'Name must not contain control characters')

  const db = get_shared_db()
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id) as { id: string } | undefined
  if (!existing)
    error(ResponseCodes.NOT_FOUND, 'User not found')

  const name = trimmed || null
  const now = new Date().toISOString()
  db.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').run(name, now, user_id)

  return json({ result: 'success', name } satisfies AdminUserNameResponseBody)
}
