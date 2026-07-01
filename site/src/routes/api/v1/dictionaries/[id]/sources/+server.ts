import type { RequestHandler } from './$types'
import type { SourceRecord, SourceReferenceCounts } from '$lib/db/server/v1-sources'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { count_source_references, create_source, list_sources } from '$lib/db/server/v1-sources'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

/** A source plus how many entries/sentences/texts reference it (for the management UI). */
export interface SourceWithUsage extends SourceRecord {
  used_by: SourceReferenceCounts
}

export interface V1SourcesGetResponseBody {
  sources: SourceWithUsage[]
}

export interface V1SourcePostRequestBody {
  slug: string
  citation?: string
  abbreviation?: string
  author?: string
  year?: string
  url?: string
  license?: string
  type?: string
}

export interface V1SourcePostResponseBody {
  source: SourceRecord
}

/** GET /api/v1/dictionaries/[id]/sources — list the citation registry + usage counts. */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, role: 'contributor' })
  const db = get_dictionary_db(dictionary.id)
  const sources = list_sources(db).map(source => ({ ...source, used_by: count_source_references(db, source.slug) }))
  return json({ sources } satisfies V1SourcesGetResponseBody)
}

/** POST /api/v1/dictionaries/[id]/sources — create a citation record. Editor+. */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, role: 'editor' })

  const body = await event.request.json() as V1SourcePostRequestBody
  let result
  try {
    result = create_source({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), user_id: access.user_id, api_key_id: access.key_id ?? null, input: body })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  log_server_event({ level: 'info', message: 'v1_source_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, slug: result.source.slug, via: access.via } })
  return json({ source: result.source } satisfies V1SourcePostResponseBody)
}
