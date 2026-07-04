import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { unstar_entry } from '$lib/db/server/v1-featured-entries'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1FeaturedEntryDeleteResponseBody {
  result: 'deleted'
}

/**
 * DELETE /api/v1/dictionaries/[id]/featured-entries/[entryId] — unstar an entry
 * (by ENTRY id, the natural key — one star per entry). Editor+ / write key.
 */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const entry_id = event.params.entryId
  if (!entry_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing entry id')

  const result = unstar_entry({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), entry_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'entry is not starred')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_entry_unstarred', user_id: access.user_id, context: { dictionary_id: dictionary.id, entry_id, via: access.via } })

  return json({ result: 'deleted' } satisfies V1FeaturedEntryDeleteResponseBody)
}
