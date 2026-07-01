import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { apply_sense_delete } from '$lib/db/server/v1-entry-write'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1SenseDeleteResponseBody {
  result: 'deleted'
}

/**
 * DELETE /api/v1/dictionaries/[id]/senses/[senseId]
 *
 * Delete one sense (FK cascade sweeps its sentence/media junctions). Refuses to
 * delete an entry's only sense (400) — delete the entry instead. Editor+.
 */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const sense_id = event.params.senseId
  if (!sense_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing sense id')

  let result
  try {
    result = apply_sense_delete({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), sense_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'sense not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_sense_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, sense_id, via: access.via } })

  return json({ result: 'deleted' } satisfies V1SenseDeleteResponseBody)
}
