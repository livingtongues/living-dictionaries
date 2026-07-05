import type { PageServerLoad } from './$types'
import { get_shared_db } from '$lib/db/server/shared-db'
import { stream } from '$lib/server/stream-load'

export interface InviteSummary {
  id: string
  dictionary_id: string
  inviter_email: string
  role: 'manager' | 'editor' | 'contributor'
  status: 'queued' | 'sent' | 'claimed' | 'cancelled'
}

/**
 * Read the invite row from shared.db so the page can show who invited + the role.
 * Streamed on client-nav data requests (instant transition), resolved on SSR;
 * consumed via `stream_resolve` (its sticky value also covers the invalidateAll
 * after accepting the invite).
 */
export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
  const { dictionary } = await parent()
  const compute = (): InviteSummary | null => {
    const invite = get_shared_db().prepare(`
      SELECT id, dictionary_id, inviter_email, role, status
      FROM invites
      WHERE id = ? AND dictionary_id = ?
    `).get(params.inviteId, dictionary.id) as InviteSummary | undefined
    return invite ?? null
  }
  return { invite: isDataRequest ? stream(compute) : compute() }
}
