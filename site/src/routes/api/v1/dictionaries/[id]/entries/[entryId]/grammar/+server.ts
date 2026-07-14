import type { RequestHandler } from './$types'
import type { GrammarSectionRecord } from '$lib/db/server/grammar-sections'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { list_entry_grammar_sections } from '$lib/db/server/grammar-sections'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { error, json } from '@sveltejs/kit'

export interface V1EntryGrammarGetResponseBody { sections: GrammarSectionRecord[] }

/** GET …/entries/[entryId]/grammar — the "grammar notes" for a headword (reverse of a section's entry link). */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  const entry_id = event.params.entryId
  if (!entry_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing entry id')
  return json({ sections: list_entry_grammar_sections(get_dictionary_db(dictionary.id), entry_id) } satisfies V1EntryGrammarGetResponseBody)
}
