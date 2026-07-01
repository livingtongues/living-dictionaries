import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { unlink_entry_tag } from '$lib/db/server/v1-sub-resources'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1EntryTagUnlinkResponseBody {
  result: 'unlinked'
}

/**
 * DELETE /api/v1/dictionaries/[id]/entries/[entryId]/tags/[tagId]
 *
 * Unlink ONE tag from ONE entry. The tag itself (and its links to other entries)
 * survives — use `DELETE …/tags/{tagId}` to remove the tag globally. Editor+.
 */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const entry_id = event.params.entryId
  const tag_id = event.params.tagId
  if (!entry_id || !tag_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing entry or tag id')

  const result = unlink_entry_tag({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), entry_id, tag_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'tag is not linked to this entry')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_entry_tag_unlinked', user_id: access.user_id, context: { dictionary_id: dictionary.id, entry_id, tag_id, via: access.via } })

  return json({ result: 'unlinked' } satisfies V1EntryTagUnlinkResponseBody)
}
