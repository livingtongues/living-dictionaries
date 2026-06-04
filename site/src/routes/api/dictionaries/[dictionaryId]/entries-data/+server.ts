import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_entries_data } from '$lib/db/server/get-dictionary-entries-data'

/**
 * M4 Phase B entries read endpoint. Returns the full per-dictionary content
 * bundle (entries, senses, media + junctions) from `dictionaries/{id}.db`
 * (better-sqlite3, server-only), projected to the legacy supabase shape the
 * Orama search worker consumes. Replaces the M1 stub / Supabase paging in
 * `cached_data_table`.
 *
 * The dict-db file is keyed by dictionary id, so resolve url-slug → id via
 * shared.db first (the worker passes the resolved id today, but be defensive).
 */
export const GET: RequestHandler = ({ params }) => {
  const dictionary = get_dictionary_by_url_or_id(params.dictionaryId)
  if (!dictionary)
    return json({ error: 'dictionary not found' }, { status: ResponseCodes.NOT_FOUND })

  const db = get_dictionary_db(dictionary.id)
  const bundle = get_dictionary_entries_data({ db })
  return json(bundle)
}
