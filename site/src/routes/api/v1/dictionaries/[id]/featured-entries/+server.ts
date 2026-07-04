import type { RequestHandler } from './$types'
import type { FeaturedEntryRecord } from '$lib/db/server/v1-featured-entries'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { EntryNotFoundError, list_featured_entries, reorder_featured_entries, star_entry } from '$lib/db/server/v1-featured-entries'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1FeaturedEntriesGetResponseBody {
  featured_entries: FeaturedEntryRecord[]
}

export interface V1FeaturedEntryPostRequestBody {
  entry_id: string
}

export interface V1FeaturedEntryPostResponseBody {
  featured_entry: FeaturedEntryRecord
  /** false → the entry was already starred (idempotent no-op). */
  created: boolean
}

export interface V1FeaturedEntriesPatchRequestBody {
  /** Every starred entry id exactly once, in the desired strip order. */
  order: string[]
}

export interface V1FeaturedEntriesPatchResponseBody {
  featured_entries: FeaturedEntryRecord[]
}

/** GET /api/v1/dictionaries/[id]/featured-entries — starred entries in strip order. */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  return json({ featured_entries: list_featured_entries(get_dictionary_db(dictionary.id)) } satisfies V1FeaturedEntriesGetResponseBody)
}

/**
 * POST /api/v1/dictionaries/[id]/featured-entries — star an entry (appends to
 * the end of the dictionary-home featured strip). Idempotent. Editor+ / write key.
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const { entry_id } = await event.request.json() as V1FeaturedEntryPostRequestBody
  if (!entry_id || typeof entry_id !== 'string')
    error(ResponseCodes.BAD_REQUEST, 'entry_id is required')

  let result
  try {
    result = star_entry({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), entry_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    if (err instanceof EntryNotFoundError)
      error(ResponseCodes.NOT_FOUND, err.message)
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (result.created)
    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  log_server_event({ level: 'info', message: 'v1_entry_starred', user_id: access.user_id, context: { dictionary_id: dictionary.id, entry_id, created: result.created, via: access.via } })
  return json({ featured_entry: result.featured_entry, created: result.created } satisfies V1FeaturedEntryPostResponseBody)
}

/**
 * PATCH /api/v1/dictionaries/[id]/featured-entries — reorder the whole strip.
 * `order` must list every starred entry id exactly once. Editor+ / write key.
 */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const { order } = await event.request.json() as V1FeaturedEntriesPatchRequestBody
  if (!Array.isArray(order) || order.some(entry_id => typeof entry_id !== 'string'))
    error(ResponseCodes.BAD_REQUEST, 'order must be an array of entry ids')

  let result
  try {
    result = reorder_featured_entries({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), order, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  log_server_event({ level: 'info', message: 'v1_featured_entries_reordered', user_id: access.user_id, context: { dictionary_id: dictionary.id, count: order.length, via: access.via } })
  return json({ featured_entries: result.featured_entries } satisfies V1FeaturedEntriesPatchResponseBody)
}
