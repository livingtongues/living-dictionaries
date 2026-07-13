import type { RequestHandler } from './$types'
import type { DialectRecord } from '$lib/db/server/v1-sub-resources'
import type { Coordinates, MultiString } from '$lib/types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { apply_dialect_delete, apply_dialect_update, list_dialects } from '$lib/db/server/v1-sub-resources'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1DialectPatchRequestBody {
  name?: MultiString | string
  /** Whole-object replace: `{ points?, regions? }` overwrites; `null` clears; omit → untouched. */
  coordinates?: Coordinates | null
}

export interface V1DialectPatchResponseBody {
  dialect: DialectRecord
}

export interface V1DialectDeleteResponseBody {
  result: 'deleted'
}

/**
 * PATCH /api/v1/dictionaries/[id]/dialects/[dialectId]
 *
 * Rename a dialect (string or locale map) — affects every entry it's on. Editor+.
 */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const dialect_id = event.params.dialectId
  if (!dialect_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dialect id')

  const body = await event.request.json() as V1DialectPatchRequestBody
  const db = get_dictionary_db(dictionary.id)

  let result
  try {
    result = apply_dialect_update({ db, history_db: get_dictionary_history_db(dictionary.id), dialect_id, name: body.name, coordinates: body.coordinates, has_coordinates: 'coordinates' in body, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'dialect not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_dialect_updated', user_id: access.user_id, context: { dictionary_id: dictionary.id, dialect_id, via: access.via } })

  const dialect = list_dialects(db).find(candidate => candidate.id === dialect_id)
  if (!dialect)
    error(ResponseCodes.NOT_FOUND, 'dialect not found')
  return json({ dialect } satisfies V1DialectPatchResponseBody)
}

/**
 * DELETE /api/v1/dictionaries/[id]/dialects/[dialectId]
 *
 * Delete a dialect globally — the FK cascade unlinks it from every entry. Editor+.
 */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const dialect_id = event.params.dialectId
  if (!dialect_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dialect id')

  const result = apply_dialect_delete({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), dialect_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'dialect not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_dialect_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, dialect_id, via: access.via } })

  return json({ result: 'deleted' } satisfies V1DialectDeleteResponseBody)
}
