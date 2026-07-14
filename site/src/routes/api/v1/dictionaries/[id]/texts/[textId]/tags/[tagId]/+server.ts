import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { unlink_text_tag } from '$lib/db/server/v1-texts'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1TextTagDeleteResponseBody { result: 'unlinked' }

/** DELETE …/texts/[textId]/tags/[tagId] — unlink the tag from this text; the tag survives. Editor+. */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const text_id = event.params.textId
  const tag_id = event.params.tagId
  if (!text_id || !tag_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing text or tag id')
  const result = unlink_text_tag({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), text_id, tag_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'tag not attached to this text')
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_text_tag_unlinked', user_id: access.user_id, context: { dictionary_id: dictionary.id, text_id, tag_id, via: access.via } })
  return json({ result: 'unlinked' } satisfies V1TextTagDeleteResponseBody)
}
