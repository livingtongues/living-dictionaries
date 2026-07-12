import type { RequestHandler } from './$types'
import { revoke_api_key } from '$lib/api-keys/api-key'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_shared_db } from '$lib/db/server/shared-db'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface DictionariesIdApiKeysKeyIdDeleteResponseBody {
  result: 'revoked'
}

/**
 * Revoke (not hard-delete) an API key. The row is retained so its id keeps
 * resolving in change history; the token stops working immediately. Manager-gated.
 */
export const DELETE: RequestHandler = async (event) => {
  const dictionary = get_dictionary_by_url_or_id(event.params.id)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  const auth = await verify_auth_dict_role(event, { dictionary, min_role: 'manager' })

  const { key_id } = event.params
  if (!key_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing key id')

  const revoked = revoke_api_key({ db: get_shared_db(), dictionary_id: dictionary.id, key_id })
  if (!revoked)
    error(ResponseCodes.NOT_FOUND, 'API key not found')

  log_server_event({ level: 'info', message: 'api_key_revoked', user_id: auth.user_id, context: { dictionary_id: dictionary.id, key_id } })
  return json({ result: 'revoked' } satisfies DictionariesIdApiKeysKeyIdDeleteResponseBody)
}
