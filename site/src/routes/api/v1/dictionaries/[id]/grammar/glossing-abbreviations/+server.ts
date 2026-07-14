import type { RequestHandler } from './$types'
import type { GlossingAbbreviationInput, GlossingAbbreviationRecord } from '$lib/db/server/grammar-sections'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { find_or_create_glossing_abbreviation, list_glossing_abbreviations } from '$lib/db/server/grammar-sections'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1GlossingAbbreviationsGetResponseBody { glossing_abbreviations: GlossingAbbreviationRecord[] }
export type V1GlossingAbbreviationPostRequestBody = GlossingAbbreviationInput
export interface V1GlossingAbbreviationPostResponseBody { glossing_abbreviation: GlossingAbbreviationRecord, created: boolean }

/** GET …/grammar/glossing-abbreviations — the dictionary's IGT gloss legend. */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  return json({ glossing_abbreviations: list_glossing_abbreviations(get_dictionary_db(dictionary.id)) } satisfies V1GlossingAbbreviationsGetResponseBody)
}

/** POST …/grammar/glossing-abbreviations — find-or-create by code. Editor+. */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const input = await event.request.json() as V1GlossingAbbreviationPostRequestBody
  let result
  try {
    result = find_or_create_glossing_abbreviation({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), user_id: access.user_id, api_key_id: access.key_id ?? null, input })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (result.created)
    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  log_server_event({ level: 'info', message: 'v1_glossing_abbreviation_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, code: result.glossing_abbreviation.code, created: result.created, via: access.via } })
  return json({ glossing_abbreviation: result.glossing_abbreviation, created: result.created } satisfies V1GlossingAbbreviationPostResponseBody)
}
