import type { Cookies } from '@sveltejs/kit'
import type { ApiKeyRole } from '$lib/api-keys/api-key'
import { API_KEY_PREFIX, verify_api_key } from '$lib/api-keys/api-key'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error } from '@sveltejs/kit'
import { verify_auth_dict_role } from './verify-dict-role'

const ROLE_RANK = { contributor: 1, editor: 2, manager: 3 } as const
type Role = keyof typeof ROLE_RANK

// API keys carry a simpler read/write access level; map it onto the same rank
// scale so a key can be checked against an endpoint's `min_role`
// (read → contributor rank, write → editor rank).
const API_KEY_RANK: Record<ApiKeyRole, number> = { read: ROLE_RANK.contributor, write: ROLE_RANK.editor }

export interface DictApiAccess {
  /** The acting human's user id — for an API key, the key's creator. */
  user_id: string
  role: Role | 'admin' | ApiKeyRole
  /** How the caller authenticated. */
  via: 'api_key' | 'session'
  /** Present only for the API-key path. */
  key_id?: string
}

/**
 * Auth gate for the public `/api/v1/dictionaries/:id/*` write API.
 *
 * Accepts EITHER:
 *   - an `Authorization: Bearer ldk_…` API key scoped to THIS dictionary, or
 *   - a normal session (cookie JWT / Bearer JWT) resolved through
 *     `verify_auth_dict_role` (so the same endpoints work from the logged-in UI
 *     or a personal JWT too).
 *
 * `dict_id` MUST be the canonical dictionary id (resolve url-slugs with
 * `get_dictionary_by_url_or_id` before calling). API writes are attributed to
 * the key's creator so history/audit columns name a real human.
 *
 * Throws 401 (no/invalid credential), 403 (key for another dict, or
 * insufficient role).
 */
export async function verify_dict_api_access(event: {
  request: Request
  cookies?: Pick<Cookies, 'get'>
}, dict_id: string, min_role: Role = 'editor'): Promise<DictApiAccess> {
  const auth_header = event.request.headers.get('Authorization')
  const bearer = auth_header?.startsWith('Bearer ') ? auth_header.slice('Bearer '.length) : null

  // API-key path — only when the bearer is explicitly an LD key. A JWT bearer
  // falls through to the session path below.
  if (bearer && bearer.startsWith(API_KEY_PREFIX)) {
    const verified = verify_api_key({ db: get_shared_db(), token: bearer })
    if (!verified)
      error(ResponseCodes.UNAUTHORIZED, 'Invalid or revoked API key')
    if (verified.dictionary_id !== dict_id)
      error(ResponseCodes.FORBIDDEN, 'API key is scoped to a different dictionary')

    const key_role = verified.role
    if (API_KEY_RANK[key_role] < ROLE_RANK[min_role])
      error(ResponseCodes.FORBIDDEN, 'This API key is read-only — a read & write key is required for this action')

    return {
      // Fall back to a stable synthetic id if the creator was deleted, so
      // dict.db's NOT NULL audit columns always resolve.
      user_id: verified.created_by_user_id ?? `apikey:${verified.key_id}`,
      role: key_role,
      via: 'api_key',
      key_id: verified.key_id,
    }
  }

  // Session / JWT path.
  const auth = await verify_auth_dict_role(event, dict_id, min_role)
  return { user_id: auth.user_id, role: auth.role, via: 'session' }
}
