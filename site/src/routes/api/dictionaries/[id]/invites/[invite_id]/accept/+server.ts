import type { RequestHandler } from './$types'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

/**
 * POST /api/dictionaries/[id]/invites/[invite_id]/accept
 *
 * Claim an invite. The invite id is the secret (a UUID emailed to the target),
 * so any authenticated user holding the link may accept it (parity with the
 * legacy flow). Inserts a `dictionary_roles` grant for the current user and
 * flips the invite to `claimed`. Both writes set `dirty = 1` so the admin.db
 * sync engine pulls them down.
 */
export interface DictionariesIdInvitesInviteIdAcceptResponseBody {
  result: 'accepted'
  role: 'manager' | 'contributor'
}

export const POST: RequestHandler = async (event) => {
  const dict_id = event.params.id
  const { invite_id } = event.params
  if (!dict_id || !invite_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id or invite id')

  const { user_id } = await verify_auth(event)

  const db = get_shared_db()

  const invite = db.prepare(`
    SELECT id, dictionary_id, inviter_user_id, role, status
    FROM invites
    WHERE id = ? AND dictionary_id = ?
  `).get(invite_id, dict_id) as
  | { id: string, dictionary_id: string, inviter_user_id: string, role: 'manager' | 'contributor', status: string }
  | undefined

  if (!invite)
    error(ResponseCodes.NOT_FOUND, 'Invite not found')
  if (invite.status !== 'queued' && invite.status !== 'sent')
    error(ResponseCodes.CONFLICT, `Invite is ${invite.status}`)

  const now = new Date().toISOString()

  try {
    const role_id = crypto.randomUUID()
    db.prepare(`
      INSERT INTO dictionary_roles
        (id, dictionary_id, user_id, role, invited_by_user_id, dirty, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT (dictionary_id, user_id, role) DO UPDATE SET
        dirty = 1,
        updated_at = excluded.updated_at
    `).run(role_id, dict_id, user_id, invite.role, invite.inviter_user_id, now, now)

    db.prepare(`UPDATE invites SET status = 'claimed', dirty = 1, updated_at = ? WHERE id = ?`)
      .run(now, invite_id)
  } catch (err) {
    console.error(`Error accepting invite: ${(err as Error).message}`)
    log_server_event({ level: 'error', message: 'invite_accept_failed', error: err, user_id, context: { dictionary_id: dict_id, invite_id } })
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Could not accept invite')
  }

  return json({ result: 'accepted', role: invite.role } satisfies DictionariesIdInvitesInviteIdAcceptResponseBody)
}
