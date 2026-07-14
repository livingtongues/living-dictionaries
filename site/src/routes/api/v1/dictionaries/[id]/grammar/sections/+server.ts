import type { RequestHandler } from './$types'
import type { GrammarSectionInput, GrammarSectionRecord } from '$lib/db/server/grammar-sections'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { create_section, list_sections } from '$lib/db/server/grammar-sections'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1GrammarSectionsGetResponseBody { sections: GrammarSectionRecord[] }
export type V1GrammarSectionPostRequestBody = GrammarSectionInput
export interface V1GrammarSectionPostResponseBody { section: GrammarSectionRecord, created: boolean }

/** GET …/grammar/sections — the section tree; filter with ?entry_id= or ?parent_id=. */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  const filter: { entry_id?: string, parent_id?: string } = {}
  const entry_id = event.url.searchParams.get('entry_id')
  if (entry_id) filter.entry_id = entry_id
  const parent_id = event.url.searchParams.get('parent_id')
  if (parent_id !== null) filter.parent_id = parent_id
  return json({ sections: list_sections(get_dictionary_db(dictionary.id), filter) } satisfies V1GrammarSectionsGetResponseBody)
}

/** POST …/grammar/sections — create a section (optionally nested + linked). Editor+ / write key. */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const input = await event.request.json() as V1GrammarSectionPostRequestBody
  let result
  try {
    result = create_section({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), user_id: access.user_id, api_key_id: access.key_id ?? null, input })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (result.created)
    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  log_server_event({ level: 'info', message: 'v1_grammar_section_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, section_id: result.section.id, created: result.created, via: access.via } })
  return json({ section: result.section, created: result.created } satisfies V1GrammarSectionPostResponseBody)
}
