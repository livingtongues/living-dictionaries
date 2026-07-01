import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { apply_relationship_delete } from '$lib/db/server/v1-relationship-write'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1RelationshipDeleteResponseBody {
  result: 'deleted'
}

/**
 * DELETE /api/v1/dictionaries/[id]/relationships/[relationshipId]
 *
 * Remove one relationship (tombstone → cascade), exactly like an editor delete.
 * Editor+.
 */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const relationship_id = event.params.relationshipId
  if (!relationship_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing relationship id')

  const result = apply_relationship_delete({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), id: relationship_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'relationship not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_relationship_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, relationship_id, via: access.via } })

  return json({ result: 'deleted' } satisfies V1RelationshipDeleteResponseBody)
}
