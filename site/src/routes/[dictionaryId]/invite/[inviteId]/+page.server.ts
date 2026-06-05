import type { PageServerLoad } from './$types'
import { get_shared_db } from '$lib/db/server/shared-db'

export interface InviteSummary {
  id: string
  dictionary_id: string
  inviter_email: string
  role: 'manager' | 'editor' | 'contributor'
  status: 'queued' | 'sent' | 'claimed' | 'cancelled'
}

/** Read the invite row from shared.db so the page can show who invited + the role. */
export const load: PageServerLoad = async ({ params, parent }) => {
  const { dictionary } = await parent()
  const db = get_shared_db()
  const invite = db.prepare(`
    SELECT id, dictionary_id, inviter_email, role, status
    FROM invites
    WHERE id = ? AND dictionary_id = ?
  `).get(params.inviteId, dictionary.id) as InviteSummary | undefined

  return { invite: invite ?? null }
}
