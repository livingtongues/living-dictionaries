/**
 * Admin tool to manually point a message thread at a user.
 *
 * Used by the unmatched-thread re-linker UI at `/admin/messages/unmatched`.
 * The legacy email-inbound flow only matches threads by `users.email`
 * (case-insensitive). When a customer emails from an address that isn't their
 * primary login email and we don't yet have it as an alias, the thread lands
 * with `from_user_id=NULL`. This endpoint lets an admin pick the right user
 * and:
 *
 *   1. Stamps `from_user_id` on the thread.
 *   2. Backfills `author_user_id` on every NULL customer-side message in the
 *      thread (so the per-user thread list on the user detail page shows it).
 *   3. Inserts an `email_aliases` row tying the thread's `from_email` → user
 *      with `source='inbound-match'`. Future inbound mail from that address
 *      now auto-resolves. INSERT OR IGNORE so a re-link is a no-op.
 *      (Skipped if `users.email` already equals the thread's from_email, or
 *      if `from_email` is a blocked system/no-reply address.)
 *
 * Idempotent: re-running for the same (thread_id, user_id) pair does no harm.
 * Admin-only.
 */
import type { RequestHandler } from './$types'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { is_blocked_recipient } from '$lib/email/loop-protection'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

export interface AdminMatchThreadToUserRequestBody {
  thread_id: string
  user_id: string
}

export interface AdminMatchThreadToUserResponseBody {
  ok: true
  thread_id: string
  user_id: string
  alias_inserted: boolean
  messages_backfilled: number
}

interface ThreadRow {
  id: string
  from_email: string
  from_user_id: string | null
}

interface UserRow {
  id: string
  email: string | null
}

export const POST: RequestHandler = async (event) => {
  const { email: caller_email } = await verify_auth(event)
  if (!is_admin(caller_email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const { thread_id, user_id } = await event.request.json() as AdminMatchThreadToUserRequestBody
  if (!thread_id || !user_id)
    error(ResponseCodes.BAD_REQUEST, 'thread_id and user_id required')

  const db = get_shared_db()

  const thread = db.prepare(
    'SELECT id, from_email, from_user_id FROM message_threads WHERE id = ?',
  ).get(thread_id) as ThreadRow | undefined
  if (!thread)
    error(ResponseCodes.NOT_FOUND, 'thread not found')

  const user = db.prepare(
    'SELECT id, email FROM users WHERE id = ?',
  ).get(user_id) as UserRow | undefined
  if (!user)
    error(ResponseCodes.BAD_REQUEST, 'user not found')

  const now = new Date().toISOString()
  let alias_inserted = false
  let messages_backfilled = 0

  const txn = db.transaction(() => {
    db.prepare(`
      UPDATE message_threads
      SET from_user_id = ?, dirty = 1, updated_at = ?
      WHERE id = ?
    `).run(user.id, now, thread_id)

    const backfill = db.prepare(`
      UPDATE messages
      SET author_user_id = ?, dirty = 1, updated_at = ?
      WHERE thread_id = ? AND author_kind = 'customer' AND author_user_id IS NULL
    `).run(user.id, now, thread_id)
    messages_backfilled = backfill.changes

    const user_email_lower = user.email?.toLowerCase() ?? null
    if (thread.from_email !== user_email_lower && !is_blocked_recipient(thread.from_email)) {
      const insert = db.prepare(`
        INSERT OR IGNORE INTO email_aliases (email, user_id, source, created_at, updated_at)
        VALUES (?, ?, 'inbound-match', ?, ?)
      `).run(thread.from_email, user.id, now, now)
      alias_inserted = insert.changes > 0
    }
  })
  txn()

  return json({
    ok: true,
    thread_id,
    user_id,
    alias_inserted,
    messages_backfilled,
  } satisfies AdminMatchThreadToUserResponseBody)
}
