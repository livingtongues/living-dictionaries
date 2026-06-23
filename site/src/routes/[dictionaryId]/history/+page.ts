import { error } from '@sveltejs/kit'
import { ResponseCodes } from '$lib/constants'

/**
 * Dictionary-wide change-history feed. Editors / managers / admins only —
 * mirrors the server read gate (`verify_auth_dict_role(…, 'editor')`). The
 * page renders `<ChangeHistory feed>`, which fetches from
 * `/api/dictionary/[id]/history?feed=1` (also gated server-side).
 */
export async function load({ parent }) {
  const { is_editor_or_above } = await parent()
  if (!is_editor_or_above)
    error(ResponseCodes.FORBIDDEN, 'Only editors and managers can view dictionary history')
  return {}
}
