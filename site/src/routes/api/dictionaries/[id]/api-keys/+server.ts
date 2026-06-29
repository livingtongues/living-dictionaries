import type { RequestHandler } from './$types'
import type { ApiKeyRecord, ApiKeyRole } from '$lib/api-keys/api-key'
import { create_api_key, list_api_keys } from '$lib/api-keys/api-key'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_shared_db } from '$lib/db/server/shared-db'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

/**
 * Manager-scoped CRUD for a dictionary's `/api/v1` API keys (the settings
 * panel). Site admins + dictionary managers pass the gate. The raw token is
 * returned ONLY on create; thereafter only display fields (prefix…last4) are
 * available.
 */

const VALID_ROLES = new Set<ApiKeyRole>(['manager', 'editor', 'contributor'])

export interface DictionariesIdApiKeysGetResponseBody {
  keys: ApiKeyRecord[]
}

export const GET: RequestHandler = async (event) => {
  const dictionary = get_dictionary_by_url_or_id(event.params.id)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  await verify_auth_dict_role(event, dictionary.id, 'manager')

  const keys = list_api_keys({ db: get_shared_db(), dictionary_id: dictionary.id })
  return json({ keys } satisfies DictionariesIdApiKeysGetResponseBody)
}

export interface DictionariesIdApiKeysPostRequestBody {
  label: string
  role?: ApiKeyRole
}

export interface DictionariesIdApiKeysPostResponseBody {
  key: ApiKeyRecord
  /** Full raw token — shown to the user ONCE. */
  token: string
}

export const POST: RequestHandler = async (event) => {
  const dictionary = get_dictionary_by_url_or_id(event.params.id)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  const auth = await verify_auth_dict_role(event, dictionary.id, 'manager')

  const body = await event.request.json() as DictionariesIdApiKeysPostRequestBody
  const label = (body.label || '').trim()
  if (!label)
    error(ResponseCodes.BAD_REQUEST, 'label required')
  const role = body.role ?? 'manager'
  if (!VALID_ROLES.has(role))
    error(ResponseCodes.BAD_REQUEST, `invalid role: ${role}`)

  const { record, token } = create_api_key({
    db: get_shared_db(),
    dictionary_id: dictionary.id,
    label,
    role,
    created_by_user_id: auth.user_id,
  })
  log_server_event({ level: 'info', message: 'api_key_created', user_id: auth.user_id, context: { dictionary_id: dictionary.id, key_id: record.id, role } })
  return json({ key: record, token } satisfies DictionariesIdApiKeysPostResponseBody)
}
