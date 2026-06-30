import type { RequestHandler } from './$types'
import type { EntryData } from '$lib/types'
import type { EntryPatch } from '$lib/api/v1/entry-input'
import { ResponseCodes } from '$lib/constants'
import { build_entry_data } from '$lib/db/server/build-entry-data'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { apply_entry_delete, apply_entry_update } from '$lib/db/server/v1-entry-write'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1EntryResponseBody {
  entry: EntryData
}

export interface V1EntryDeleteResponseBody {
  result: 'deleted'
}

/**
 * GET /api/v1/dictionaries/[id]/entries/[entryId]
 *
 * Read one fully-assembled entry (nested senses → glosses, example sentences,
 * dialects, tags) — the read-side mirror of the write shape, for verification +
 * dedupe. Key/session gated (contributor+); a dict-scoped caller sees their own
 * private content.
 */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, role: 'contributor' })

  const entry_id = event.params.entryId
  if (!entry_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing entry id')

  const entry = build_entry_data({ db: get_dictionary_db(dictionary.id), entry_id, admin_level: 1 })
  if (!entry)
    error(ResponseCodes.NOT_FOUND, 'entry not found')

  return json({ entry } satisfies V1EntryResponseBody)
}

/**
 * PATCH /api/v1/dictionaries/[id]/entries/[entryId]
 *
 * Field-merge an entry: provided entry/sense fields overwrite, omitted stay.
 * `senses` upsert by id (no id → create); example sentences are appended;
 * `dialects`/`tags` are additive links. Returns the updated nested entry.
 */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, role: 'editor' })

  const entry_id = event.params.entryId
  if (!entry_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing entry id')

  const patch = await event.request.json() as EntryPatch
  const db = get_dictionary_db(dictionary.id)

  let result
  try {
    result = apply_entry_update({ db, history_db: get_dictionary_history_db(dictionary.id), entry_id, patch, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'entry not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_entry_updated', user_id: access.user_id, context: { dictionary_id: dictionary.id, entry_id, via: access.via } })

  const entry = build_entry_data({ db, entry_id, admin_level: 1 })
  if (!entry)
    error(ResponseCodes.NOT_FOUND, 'entry not found')
  return json({ entry } satisfies V1EntryResponseBody)
}

/**
 * DELETE /api/v1/dictionaries/[id]/entries/[entryId]
 *
 * Hard-delete an entry (tombstone → cascade to senses/sentences/junctions),
 * exactly like an editor delete.
 */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, role: 'editor' })

  const entry_id = event.params.entryId
  if (!entry_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing entry id')

  const result = apply_entry_delete({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), entry_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'entry not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_entry_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, entry_id, via: access.via } })

  return json({ result: 'deleted' } satisfies V1EntryDeleteResponseBody)
}
