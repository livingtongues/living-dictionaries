import type { Cookies } from '@sveltejs/kit'
import type { ApiKeyRole } from '$lib/api-keys/api-key'
import type { DictRole } from './verify-dict-role'
import { API_KEY_PREFIX, verify_api_key } from '$lib/api-keys/api-key'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error } from '@sveltejs/kit'
import { verify_auth_dict_role } from './verify-dict-role'

/**
 * The two access levels the v1 API gates on. These are the API's OWN vocabulary
 * — deliberately NOT the human dictionary roles (contributor/editor/manager).
 *   - `read`  → any GET endpoint.
 *   - `write` → any mutating endpoint.
 * A key carries a scope of the same names; the human-session fallback translates
 * these to a role in ONE isolated spot (see below) — that translation is the
 * only place the two systems meet.
 */
export type ApiAccess = 'read' | 'write'

/** An API key's `write` scope implies `read`; a `read` key can only read. */
function key_scope_allows(scope: ApiKeyRole, needed: ApiAccess): boolean {
  return needed === 'read' ? true : scope === 'write'
}

/**
 * Human-session fallback ONLY: which dictionary role a logged-in human needs to
 * exercise this access level via the v1 endpoints. Isolated here so the key path
 * never touches contributor/editor semantics.
 *   - read  → any member of the dictionary (contributor+) may read.
 *   - write → editor+ (admins bypass, per verify_auth_dict_role).
 */
const ACCESS_TO_HUMAN_ROLE: Record<ApiAccess, DictRole> = { read: 'contributor', write: 'editor' }

export interface DictApiAccess {
  /** The acting human's user id — for an API key, the key's creator. */
  user_id: string
  role: DictRole | 'admin' | ApiKeyRole
  /** How the caller authenticated. */
  via: 'api_key' | 'session'
  /** Present only for the API-key path. */
  key_id?: string
}

/**
 * Auth gate for the public `/api/v1/dictionaries/:id/*` API.
 *
 * Accepts EITHER:
 *   - an `Authorization: Bearer ldk_…` API key scoped to THIS dictionary — gated
 *     by its own `read`/`write` scope, with NO reference to human roles, or
 *   - a normal session (cookie JWT / Bearer JWT) resolved through
 *     `verify_auth_dict_role` (so the same endpoints work from a logged-in human
 *     or a personal JWT), gated by the human role `ACCESS_TO_HUMAN_ROLE` maps to.
 *
 * `dictionary` MUST be the resolved catalog row (via `get_dictionary_by_url_or_id`)
 * so key scoping checks against the canonical id and secure dictionaries
 * (`bucket = 'secure'`) tighten the human-session admin bypass to level 3 —
 * dict-scoped API keys are inside the trust boundary and work unchanged. API
 * writes are attributed to the key's creator so history/audit columns name a
 * real human.
 *
 * Throws 401 (no/invalid credential), 403 (key for another dict, or
 * insufficient scope/role), 404 (secure dict + session with no grant).
 */
export async function verify_dict_api_access(event: {
  request: Request
  cookies?: Pick<Cookies, 'get'>
}, dictionary: { id: string, bucket?: string | null }, access: ApiAccess = 'write'): Promise<DictApiAccess> {
  const auth_header = event.request.headers.get('Authorization')
  const bearer = auth_header?.startsWith('Bearer ') ? auth_header.slice('Bearer '.length) : null

  // API-key path — only when the bearer is explicitly an LD key. A JWT bearer
  // falls through to the session path below.
  if (bearer && bearer.startsWith(API_KEY_PREFIX)) {
    const verified = verify_api_key({ db: get_shared_db(), token: bearer })
    if (!verified)
      error(ResponseCodes.UNAUTHORIZED, 'Invalid or revoked API key')
    if (verified.dictionary_id !== dictionary.id)
      error(ResponseCodes.FORBIDDEN, 'API key is scoped to a different dictionary')

    if (!key_scope_allows(verified.role, access))
      error(ResponseCodes.FORBIDDEN, 'This API key is read-only — a read & write key is required for this action')

    return {
      // Fall back to a stable synthetic id if the creator was deleted, so
      // dict.db's NOT NULL audit columns always resolve.
      user_id: verified.created_by_user_id ?? `apikey:${verified.key_id}`,
      role: verified.role,
      via: 'api_key',
      key_id: verified.key_id,
    }
  }

  // Session / JWT path — the ONE place API access maps onto a human role.
  const auth = await verify_auth_dict_role(event, { dictionary, min_role: ACCESS_TO_HUMAN_ROLE[access] })
  return { user_id: auth.user_id, role: auth.role, via: 'session' }
}
