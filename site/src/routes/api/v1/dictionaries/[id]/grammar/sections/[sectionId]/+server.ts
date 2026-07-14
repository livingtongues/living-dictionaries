import type { RequestHandler } from './$types'
import type { GrammarSectionPatch, GrammarSectionRecord } from '$lib/db/server/grammar-sections'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { apply_section_delete, apply_section_update, get_section } from '$lib/db/server/grammar-sections'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1GrammarSectionResponseBody { section: GrammarSectionRecord }
export interface V1GrammarSectionDeleteResponseBody { result: 'deleted' }
export type V1GrammarSectionPatchRequestBody = GrammarSectionPatch

/** GET …/grammar/sections/[sectionId]. */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  const section_id = event.params.sectionId
  if (!section_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing section id')
  const section = get_section(get_dictionary_db(dictionary.id), section_id)
  if (!section)
    error(ResponseCodes.NOT_FOUND, 'section not found')
  return json({ section } satisfies V1GrammarSectionResponseBody)
}

/** PATCH …/grammar/sections/[sectionId] — field-merge; parent_id + after_section_id re-nest/reorder. Editor+. */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const section_id = event.params.sectionId
  if (!section_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing section id')
  const patch = await event.request.json() as V1GrammarSectionPatchRequestBody
  const db = get_dictionary_db(dictionary.id)
  let result
  try {
    result = apply_section_update({ db, history_db: get_dictionary_history_db(dictionary.id), section_id, patch, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found || !result.section)
    error(ResponseCodes.NOT_FOUND, 'section not found')
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_grammar_section_updated', user_id: access.user_id, context: { dictionary_id: dictionary.id, section_id, via: access.via } })
  return json({ section: result.section } satisfies V1GrammarSectionResponseBody)
}

/** DELETE …/grammar/sections/[sectionId] — cascades to descendants; detaches example links. Editor+. */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const section_id = event.params.sectionId
  if (!section_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing section id')
  const result = apply_section_delete({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), section_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'section not found')
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_grammar_section_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, section_id, via: access.via } })
  return json({ result: 'deleted' } satisfies V1GrammarSectionDeleteResponseBody)
}
