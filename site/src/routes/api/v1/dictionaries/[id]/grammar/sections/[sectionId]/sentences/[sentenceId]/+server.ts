import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { unlink_section_sentence } from '$lib/db/server/grammar-sections'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1SectionSentenceDeleteResponseBody { result: 'unlinked' }

/** DELETE …/sections/[sectionId]/sentences/[sentenceId] — detach the reference; the sentence survives. Editor+. */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const section_id = event.params.sectionId
  const sentence_id = event.params.sentenceId
  if (!section_id || !sentence_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing section or sentence id')
  const result = unlink_section_sentence({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), section_id, sentence_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'sentence not attached to this section')
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_section_sentence_unlinked', user_id: access.user_id, context: { dictionary_id: dictionary.id, section_id, sentence_id, via: access.via } })
  return json({ result: 'unlinked' } satisfies V1SectionSentenceDeleteResponseBody)
}
