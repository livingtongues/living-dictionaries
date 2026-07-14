import type { RequestHandler } from './$types'
import type { SectionSentenceRef } from '$lib/db/server/grammar-sections'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { link_section_sentence } from '$lib/db/server/grammar-sections'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1SectionSentencePostRequestBody { sentence_id: string, after_sentence_id?: string }
export interface V1SectionSentencePostResponseBody { link: SectionSentenceRef }

/** POST …/sections/[sectionId]/sentences — attach an existing sentence as an example (by reference). Editor+. */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const section_id = event.params.sectionId
  if (!section_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing section id')
  const { sentence_id, after_sentence_id } = await event.request.json() as V1SectionSentencePostRequestBody
  if (!sentence_id)
    error(ResponseCodes.BAD_REQUEST, 'sentence_id is required')
  let result
  try {
    result = link_section_sentence({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), section_id, sentence_id, after_sentence_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found || !result.link)
    error(ResponseCodes.NOT_FOUND, 'section or sentence not found')
  if (result.created)
    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  log_server_event({ level: 'info', message: 'v1_section_sentence_linked', user_id: access.user_id, context: { dictionary_id: dictionary.id, section_id, sentence_id, created: result.created, via: access.via } })
  return json({ link: result.link } satisfies V1SectionSentencePostResponseBody)
}
