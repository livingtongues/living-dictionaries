import type { RequestHandler } from './$types'
import type { TagRecord } from '$lib/db/server/v1-sub-resources'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { apply_tag_delete, apply_tag_update, list_tags } from '$lib/db/server/v1-sub-resources'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1TagPatchRequestBody {
  name?: string
  private?: boolean
}

export interface V1TagPatchResponseBody {
  tag: TagRecord
}

export interface V1TagDeleteResponseBody {
  result: 'deleted'
}

/**
 * PATCH /api/v1/dictionaries/[id]/tags/[tagId]
 *
 * Rename a tag and/or flip its `private` flag — affects every entry it's on.
 * Editor+.
 */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const tag_id = event.params.tagId
  if (!tag_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing tag id')

  const body = await event.request.json() as V1TagPatchRequestBody
  const db = get_dictionary_db(dictionary.id)

  let result
  try {
    result = apply_tag_update({ db, history_db: get_dictionary_history_db(dictionary.id), tag_id, name: body.name, is_private: body.private, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'tag not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_tag_updated', user_id: access.user_id, context: { dictionary_id: dictionary.id, tag_id, via: access.via } })

  const tag = list_tags(db).find(candidate => candidate.id === tag_id)
  if (!tag)
    error(ResponseCodes.NOT_FOUND, 'tag not found')
  return json({ tag } satisfies V1TagPatchResponseBody)
}

/**
 * DELETE /api/v1/dictionaries/[id]/tags/[tagId]
 *
 * Delete a tag globally — the FK cascade unlinks it from every entry. Editor+.
 */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const tag_id = event.params.tagId
  if (!tag_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing tag id')

  const result = apply_tag_delete({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), tag_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'tag not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_tag_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, tag_id, via: access.via } })

  return json({ result: 'deleted' } satisfies V1TagDeleteResponseBody)
}
