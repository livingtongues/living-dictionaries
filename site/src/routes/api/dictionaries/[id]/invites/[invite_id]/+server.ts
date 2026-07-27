import type { RequestHandler } from './$types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

/**
 * DELETE /api/dictionaries/[id]/invites/[invite_id]
 *
 * Cancel an outstanding invite. Manager (on this dict) or site admin only.
 * Marks the invite `status = 'cancelled'` (kept for audit). Admin clients pick
 * the change up from the `server_seq` trigger — `dirty` is a client-only flag and
 * is never written to a canonical row (see `sync-helpers.ts`).
 */
export interface DictionariesIdInvitesInviteIdDeleteResponseBody {
  result: 'cancelled'
}

export const DELETE: RequestHandler = async (event) => {
  const dict_id = event.params.id
  const { invite_id } = event.params
  if (!dict_id || !invite_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id or invite id')

  const dictionary = get_dictionary_by_url_or_id(dict_id)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  await verify_auth_dict_role(event, { dictionary, min_role: 'manager' })

  const db = get_shared_db()
  const row = db.prepare(
    `SELECT id FROM invites WHERE id = ? AND dictionary_id = ?`,
  ).get(invite_id, dict_id) as { id: string } | undefined
  if (!row)
    error(ResponseCodes.NOT_FOUND, 'invite not found on this dictionary')

  const now = new Date().toISOString()
  db.prepare(`UPDATE invites SET status = 'cancelled', updated_at = ? WHERE id = ?`)
    .run(now, invite_id)

  return json({ result: 'cancelled' } satisfies DictionariesIdInvitesInviteIdDeleteResponseBody)
}
