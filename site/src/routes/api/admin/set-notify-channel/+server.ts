/**
 * Self-serve control for an admin to choose WHERE their notifications arrive:
 * 'email' (default) or 'ntfy' push. Sets the CALLER's own row only — there's no
 * `user_id` param.
 *
 * Needed because `users` is download-only on admin clients (read-only directory
 * sync sector, no `dirty` column) — a local live-db `_save()` would never sync
 * up. This writes `users.notify_channel` directly to shared.db and bumps
 * `updated_at` so the admin client pulls the change on next sync. The column is
 * read server-side when a ping is sent (see `$lib/notifications/notify-admins.ts`).
 */
import type { RequestHandler } from './$types'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

export type NotifyChannel = 'email' | 'ntfy'

export interface AdminSetNotifyChannelRequestBody {
  channel: NotifyChannel
}

export interface AdminSetNotifyChannelResponseBody {
  ok: true
  channel: NotifyChannel
}

export const POST: RequestHandler = async (event) => {
  const { user_id, email } = await verify_auth(event)
  if (!is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const body = await event.request.json() as AdminSetNotifyChannelRequestBody
  if (body.channel !== 'email' && body.channel !== 'ntfy')
    error(ResponseCodes.BAD_REQUEST, 'channel must be \'email\' or \'ntfy\'')

  const now = new Date().toISOString()
  const result = get_shared_db()
    .prepare('UPDATE users SET notify_channel = ?, updated_at = ? WHERE id = ?')
    .run(body.channel, now, user_id)
  if (result.changes === 0)
    error(ResponseCodes.NOT_FOUND, 'User not found')

  return json({ ok: true, channel: body.channel } satisfies AdminSetNotifyChannelResponseBody)
}
