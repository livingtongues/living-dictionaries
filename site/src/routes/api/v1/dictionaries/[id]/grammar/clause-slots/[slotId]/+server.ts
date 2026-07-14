import type { RequestHandler } from './$types'
import type { ClauseSlotInput, ClauseSlotRecord } from '$lib/db/server/grammar-sections'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { apply_clause_slot_delete, apply_clause_slot_update } from '$lib/db/server/grammar-sections'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1ClauseSlotResponseBody { clause_slot: ClauseSlotRecord }
export interface V1ClauseSlotDeleteResponseBody { result: 'deleted' }
export type V1ClauseSlotPatchRequestBody = Pick<ClauseSlotInput, 'name' | 'code' | 'after_slot_id'>

/** PATCH …/grammar/clause-slots/[slotId] — rename / recode / reorder. Editor+. */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const slot_id = event.params.slotId
  if (!slot_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing slot id')
  const input = await event.request.json() as V1ClauseSlotPatchRequestBody
  let result
  try {
    result = apply_clause_slot_update({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), slot_id, input, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found || !result.clause_slot)
    error(ResponseCodes.NOT_FOUND, 'clause slot not found')
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_clause_slot_updated', user_id: access.user_id, context: { dictionary_id: dictionary.id, slot_id, via: access.via } })
  return json({ clause_slot: result.clause_slot } satisfies V1ClauseSlotResponseBody)
}

/** DELETE …/grammar/clause-slots/[slotId] — sections referencing it have slot_id cleared. Editor+. */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const slot_id = event.params.slotId
  if (!slot_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing slot id')
  const result = apply_clause_slot_delete({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), slot_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'clause slot not found')
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_clause_slot_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, slot_id, via: access.via } })
  return json({ result: 'deleted' } satisfies V1ClauseSlotDeleteResponseBody)
}
