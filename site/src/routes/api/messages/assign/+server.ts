import type { RequestHandler } from './$types'
import { ADMINS, is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { notify_admin } from '$lib/notifications/notify-admins'
import { error, json } from '@sveltejs/kit'

/**
 * Assign a message thread to an admin (or clear the assignment by passing
 * `assignee_user_id: null`). Updates the thread's `assigned_to_user_id`,
 * `assigned_at`, and `assigned_by_user_id`, then fires a ntfy push to the
 * new assignee — UNLESS the assignee is the caller (no point pinging yourself
 * about a thread you just self-assigned).
 *
 * Any admin can assign / reassign any thread. The assignee must be an admin.
 */

export interface MessagesAssignRequestBody {
  thread_id: string
  /** user_id of the admin to assign to, or null to clear the assignment. */
  assignee_user_id: string | null
}

export interface MessagesAssignResponseBody {
  ok: true
  assigned_to_user_id: string | null
  assigned_at: string | null
  assigned_by_user_id: string | null
}

interface ThreadRow {
  id: string
  subject: string | null
  from_name: string | null
  from_email: string
  assigned_to_user_id: string | null
}

interface UserRow {
  id: string
  email: string | null
  name: string | null
}

export const POST: RequestHandler = async (event) => {
  const { url } = event
  const { email: caller_email, user_id: caller_user_id } = await verify_auth(event)
  if (!is_admin(caller_email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const body = await event.request.json() as MessagesAssignRequestBody
  if (!body.thread_id)
    error(ResponseCodes.BAD_REQUEST, 'thread_id required')

  const db = get_shared_db()

  const thread = db.prepare('SELECT id, subject, from_name, from_email, assigned_to_user_id FROM message_threads WHERE id = ?')
    .get(body.thread_id) as ThreadRow | undefined
  if (!thread)
    error(ResponseCodes.NOT_FOUND, 'thread not found')

  // Resolve + validate the assignee (when not clearing)
  let assignee: UserRow | null = null
  if (body.assignee_user_id) {
    assignee = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(body.assignee_user_id) as UserRow | undefined ?? null
    if (!assignee)
      error(ResponseCodes.BAD_REQUEST, 'assignee user_id not found')
    if (!is_admin(assignee.email))
      error(ResponseCodes.BAD_REQUEST, 'assignee is not an admin')
  }

  const now = new Date().toISOString()
  const next_assignee = assignee?.id ?? null
  const next_assigned_at = next_assignee ? now : null
  const next_assigned_by = next_assignee ? caller_user_id : null

  db.prepare(`
    UPDATE message_threads
    SET assigned_to_user_id = ?, assigned_at = ?, assigned_by_user_id = ?, updated_at = ?
    WHERE id = ?
  `).run(next_assignee, next_assigned_at, next_assigned_by, now, body.thread_id)

  // Ping the assignee on their personal ntfy topic — unless they're the caller.
  // Only fire when the assignment actually CHANGED (avoid spamming on no-op saves).
  const assignment_changed = thread.assigned_to_user_id !== next_assignee
  if (assignment_changed && assignee && assignee.id !== caller_user_id) {
    const caller_admin = ADMINS.find(a => a.email === caller_email)
    const caller_name = caller_admin?.name ?? caller_email ?? 'an admin'
    const subject = `Assigned: ${thread.subject || '(no subject)'}`
    const body_text = `${caller_name} assigned a thread from ${thread.from_name || thread.from_email} to you.`
    const link = `${url.origin}/admin/messages/${thread.id}`
    void notify_admin({ email: assignee.email, subject, body: body_text, link })
  }

  return json({
    ok: true,
    assigned_to_user_id: next_assignee,
    assigned_at: next_assigned_at,
    assigned_by_user_id: next_assigned_by,
  } satisfies MessagesAssignResponseBody)
}
