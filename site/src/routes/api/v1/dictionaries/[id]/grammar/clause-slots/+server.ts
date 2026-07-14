import type { RequestHandler } from './$types'
import type { ClauseSlotInput, ClauseSlotRecord } from '$lib/db/server/grammar-sections'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { create_clause_slot, list_clause_slots } from '$lib/db/server/grammar-sections'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1ClauseSlotsGetResponseBody { clause_slots: ClauseSlotRecord[] }
export type V1ClauseSlotPostRequestBody = ClauseSlotInput
export interface V1ClauseSlotPostResponseBody { clause_slot: ClauseSlotRecord, created: boolean }

/** GET …/grammar/clause-slots — the ordered clause-template slot set. */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  return json({ clause_slots: list_clause_slots(get_dictionary_db(dictionary.id)) } satisfies V1ClauseSlotsGetResponseBody)
}

/** POST …/grammar/clause-slots — create a slot (order with after_slot_id). Editor+. */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const input = await event.request.json() as V1ClauseSlotPostRequestBody
  let result
  try {
    result = create_clause_slot({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), user_id: access.user_id, api_key_id: access.key_id ?? null, input })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (result.created)
    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  log_server_event({ level: 'info', message: 'v1_clause_slot_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, slot_id: result.clause_slot.id, created: result.created, via: access.via } })
  return json({ clause_slot: result.clause_slot, created: result.created } satisfies V1ClauseSlotPostResponseBody)
}
