import type { PageServerLoad } from './$types'
import type { PartnerWithPhoto } from '$lib/types'
import { get_shared_db } from '$lib/db/server/shared-db'
import { stream } from '$lib/server/stream-load'

export interface ContributorRole {
  id: string
  user_id: string
  role: 'manager' | 'editor' | 'contributor'
  full_name: string | null
}
export interface ContributorInvite {
  id: string
  inviter_email: string
  target_email: string
  role: 'manager' | 'editor' | 'contributor'
  status: string
  created_at: string
}
export interface ContributorsData {
  managers: ContributorRole[]
  contributors: ContributorRole[]
  invites: ContributorInvite[]
  partners: PartnerWithPhoto[]
}

/**
 * Editors + invites + partners for the contributors tab live in `shared.db`
 * (the catalog DB), not the per-dict `dict_db`, so they're loaded server-side.
 * Anonymous-safe — every dictionary is URL-reachable and its contributor list
 * is public (mirrors the live site). The parent layout already resolved the
 * catalog row; we use its real id.
 *
 * Streamed ONLY on client-nav data requests (`isDataRequest`) so navigation
 * transitions instantly; SSR hard loads return the resolved value (public,
 * crawlable page). The page consumes it via `stream_resolve`, whose STICKY
 * value keeps the lists visible through the `invalidate('contributors:reload')`
 * re-run after every edit (no skeleton flash).
 */
export const load: PageServerLoad = async ({ parent, depends, isDataRequest }) => {
  const { dictionary } = await parent()
  depends('contributors:reload')

  const compute = (): ContributorsData => {
    const db = get_shared_db()

    const roles = db.prepare(`
      SELECT
        dictionary_roles.id      AS id,
        dictionary_roles.user_id AS user_id,
        dictionary_roles.role    AS role,
        users.name               AS full_name
      FROM dictionary_roles
      LEFT JOIN users ON users.id = dictionary_roles.user_id
      WHERE dictionary_roles.dictionary_id = ?
      ORDER BY dictionary_roles.created_at ASC
    `).all(dictionary.id) as ContributorRole[]

    const invites = db.prepare(`
      SELECT id, inviter_email, target_email, role, status, created_at
      FROM invites
      WHERE dictionary_id = ? AND status IN ('queued', 'sent')
      ORDER BY created_at ASC
    `).all(dictionary.id) as ContributorInvite[]

    const partner_rows = db.prepare(`
      SELECT id, name, photo_serving_url, photo_storage_path
      FROM dictionary_partners
      WHERE dictionary_id = ?
      ORDER BY created_at ASC
    `).all(dictionary.id) as { id: string, name: string, photo_serving_url: string | null, photo_storage_path: string | null }[]

    const partners: PartnerWithPhoto[] = partner_rows.map(row => ({
      id: row.id,
      name: row.name,
      photo: row.photo_serving_url
        ? { id: row.id, storage_path: row.photo_storage_path ?? '', serving_url: row.photo_serving_url }
        : undefined,
    })) as PartnerWithPhoto[]

    return {
      managers: roles.filter(role => role.role === 'manager'),
      contributors: roles.filter(role => role.role === 'contributor'),
      invites,
      partners,
    }
  }

  return { contributors_data: isDataRequest ? stream(compute) : compute() }
}
