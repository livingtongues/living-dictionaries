import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { unlink_entry_dialect } from '$lib/db/server/v1-sub-resources'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1EntryDialectUnlinkResponseBody {
  result: 'unlinked'
}

/**
 * DELETE /api/v1/dictionaries/[id]/entries/[entryId]/dialects/[dialectId]
 *
 * Unlink ONE dialect from ONE entry. The dialect itself survives — use
 * `DELETE …/dialects/{dialectId}` to remove it globally. Editor+.
 */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const entry_id = event.params.entryId
  const dialect_id = event.params.dialectId
  if (!entry_id || !dialect_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing entry or dialect id')

  const result = unlink_entry_dialect({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), entry_id, dialect_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'dialect is not linked to this entry')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_entry_dialect_unlinked', user_id: access.user_id, context: { dictionary_id: dictionary.id, entry_id, dialect_id, via: access.via } })

  return json({ result: 'unlinked' } satisfies V1EntryDialectUnlinkResponseBody)
}
