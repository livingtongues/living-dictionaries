import type { RequestHandler } from './$types'
import type { SourceRecord } from '$lib/db/server/v1-sources'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { apply_source_delete, apply_source_update, count_source_references, get_source, remove_source_from_all } from '$lib/db/server/v1-sources'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1SourcePatchRequestBody {
  slug?: string
  citation?: string
  abbreviation?: string
  author?: string
  year?: string
  url?: string
  license?: string
  type?: string
}

export interface V1SourcePatchResponseBody {
  source: SourceRecord
}

export interface V1SourceDeleteResponseBody {
  result: 'deleted'
  removed_from: { entries: number, sentences: number, texts: number }
}

/** PATCH /api/v1/dictionaries/[id]/sources/[sourceId] — edit citation metadata. Editor+. */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, role: 'editor' })

  const source_id = event.params.sourceId
  if (!source_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing source id')

  const body = await event.request.json() as V1SourcePatchRequestBody
  const db = get_dictionary_db(dictionary.id)

  let result
  try {
    result = apply_source_update({ db, history_db: get_dictionary_history_db(dictionary.id), source_id, patch: body, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'source not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_source_updated', user_id: access.user_id, context: { dictionary_id: dictionary.id, source_id, via: access.via } })

  const source = get_source(db, source_id)
  if (!source)
    error(ResponseCodes.NOT_FOUND, 'source not found')
  return json({ source } satisfies V1SourcePatchResponseBody)
}

/**
 * DELETE /api/v1/dictionaries/[id]/sources/[sourceId] — Editor+.
 *
 * Refuses (409) while the source is still referenced, unless
 * `?remove_from_all=true`, which strips the slug from every referencing
 * entry/sentence/text first and then deletes.
 */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, role: 'editor' })

  const source_id = event.params.sourceId
  if (!source_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing source id')

  const db = get_dictionary_db(dictionary.id)
  const history_db = get_dictionary_history_db(dictionary.id)
  const source = get_source(db, source_id)
  if (!source)
    error(ResponseCodes.NOT_FOUND, 'source not found')

  const remove_from_all = event.url.searchParams.get('remove_from_all') === 'true'
  const counts = count_source_references(db, source.slug)
  const total = counts.entries + counts.sentences + counts.texts

  if (total > 0 && !remove_from_all)
    error(ResponseCodes.CONFLICT, `source '${source.slug}' is still used by ${counts.entries} entries, ${counts.sentences} sentences, ${counts.texts} texts; retry with ?remove_from_all=true`)

  if (total > 0)
    remove_source_from_all({ db, history_db, slug: source.slug, user_id: access.user_id, api_key_id: access.key_id ?? null })

  let result
  try {
    result = apply_source_delete({ db, history_db, source_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.CONFLICT, (err as Error).message)
  }
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'source not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_source_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, source_id, slug: source.slug, removed_from_total: total, via: access.via } })

  return json({ result: 'deleted', removed_from: counts } satisfies V1SourceDeleteResponseBody)
}
