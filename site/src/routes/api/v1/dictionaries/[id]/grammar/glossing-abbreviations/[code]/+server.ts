import type { RequestHandler } from './$types'
import type { GlossingAbbreviationRecord } from '$lib/db/server/grammar-sections'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { apply_glossing_abbreviation_delete, apply_glossing_abbreviation_update } from '$lib/db/server/grammar-sections'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1GlossingAbbreviationResponseBody { glossing_abbreviation: GlossingAbbreviationRecord }
export interface V1GlossingAbbreviationDeleteResponseBody { result: 'deleted' }
export interface V1GlossingAbbreviationPatchRequestBody { name?: string | Record<string, string>, category?: string | null }

/** PATCH …/grammar/glossing-abbreviations/[code] — edit the expansion / category. Editor+. */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const { code } = event.params
  if (!code)
    error(ResponseCodes.BAD_REQUEST, 'Missing code')
  const input = await event.request.json() as V1GlossingAbbreviationPatchRequestBody
  let result
  try {
    result = apply_glossing_abbreviation_update({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), code, input, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found || !result.glossing_abbreviation)
    error(ResponseCodes.NOT_FOUND, 'glossing abbreviation not found')
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_glossing_abbreviation_updated', user_id: access.user_id, context: { dictionary_id: dictionary.id, code, via: access.via } })
  return json({ glossing_abbreviation: result.glossing_abbreviation } satisfies V1GlossingAbbreviationResponseBody)
}

/** DELETE …/grammar/glossing-abbreviations/[code]. Editor+. */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const { code } = event.params
  if (!code)
    error(ResponseCodes.BAD_REQUEST, 'Missing code')
  const result = apply_glossing_abbreviation_delete({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), code, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'glossing abbreviation not found')
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_glossing_abbreviation_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, code, via: access.via } })
  return json({ result: 'deleted' } satisfies V1GlossingAbbreviationDeleteResponseBody)
}
