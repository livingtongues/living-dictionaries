import { error } from '@sveltejs/kit'
import { ResponseCodes } from '$lib/constants'

/**
 * Dictionary-wide change-history feed. Managers / admins only — mirrors the
 * server read gate (`verify_auth_dict_role(…, 'manager')`). The page renders
 * `<ChangeHistory feed>`, which fetches from
 * `/api/dictionary/[id]/history?feed=1` (also gated server-side).
 */
export async function load({ parent }) {
  const { is_manager } = await parent()
  if (!is_manager)
    error(ResponseCodes.FORBIDDEN, 'Only managers can view dictionary history')
  return {}
}
