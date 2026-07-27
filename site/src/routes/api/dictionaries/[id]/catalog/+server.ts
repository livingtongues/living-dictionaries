import type { RequestHandler } from './$types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { CatalogFieldError, update_dictionary_catalog } from '$lib/db/server/dictionary-catalog'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_shared_db } from '$lib/db/server/shared-db'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

/**
 * Update a dictionary's catalog metadata in shared.db. Manager-gated (site
 * admins bypass). Used by the dictionary settings page + the about tab.
 *
 * The caller sends a partial `{ field: value }`; the allowlist, JSON handling
 * and validation all live in `$lib/db/server/dictionary-catalog.ts`, shared with
 * the agent-facing `PATCH /api/v1/dictionaries/[id]`.
 */

export type DictionariesCatalogRequestBody = Record<string, unknown>

export interface DictionariesCatalogResponseBody {
  result: 'success'
}

export const POST: RequestHandler = async (event) => {
  const dict_id = event.params.id
  const dictionary = get_dictionary_by_url_or_id(dict_id ?? '')
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  const { user_id } = await verify_auth_dict_role(event, { dictionary, min_role: 'manager' })

  const body = await event.request.json() as DictionariesCatalogRequestBody

  try {
    update_dictionary_catalog({ db: get_shared_db(), dictionary_id: dictionary.id, fields: body, user_id })
  } catch (err) {
    if (err instanceof CatalogFieldError)
      error(ResponseCodes.BAD_REQUEST, err.message)
    console.error(`Error updating dictionary catalog: ${(err as Error).message}`)
    log_server_event({ level: 'error', message: 'dictionary_catalog_update_failed', error: err, user_id, context: { dictionary_id: dictionary.id, fields: Object.keys(body) } })
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Could not update dictionary')
  }

  return json({ result: 'success' } satisfies DictionariesCatalogResponseBody)
}
