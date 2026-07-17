import type { RequestHandler } from './$types'
import type { TextPatchInput, TextRecord } from '$lib/db/server/v1-texts'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { add_audio_download_urls, apply_text_delete, apply_text_update, get_text } from '$lib/db/server/v1-texts'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1TextResponseBody {
  text: TextRecord
}

export interface V1TextDeleteResponseBody {
  result: 'deleted'
}

export type V1TextPatchRequestBody = TextPatchInput

/**
 * GET /api/v1/dictionaries/[id]/texts/[textId] — the text + its ordered
 * sentences, attached audio (text- and sentence-level, each with `timings` and
 * a `download_url` for the bytes), and the referenced speaker records.
 */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })

  const text_id = event.params.textId
  if (!text_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing text id')

  const text = get_text(get_dictionary_db(dictionary.id), text_id)
  if (!text)
    error(ResponseCodes.NOT_FOUND, 'text not found')
  return json({ text: add_audio_download_urls({ text, origin: event.url.origin, dict_id: dictionary.id }) } satisfies V1TextResponseBody)
}

/**
 * PATCH /api/v1/dictionaries/[id]/texts/[textId] — edit the title, append
 * sentences, and/or reorder existing sentences (`sentence_order`). Editor+.
 * Edit a single sentence's text/translation/paragraph-break via
 * `PATCH …/sentences/{id}`.
 */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const text_id = event.params.textId
  if (!text_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing text id')

  const patch = await event.request.json() as V1TextPatchRequestBody
  const db = get_dictionary_db(dictionary.id)

  let result
  try {
    result = apply_text_update({ db, history_db: get_dictionary_history_db(dictionary.id), text_id, patch, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found || !result.text)
    error(ResponseCodes.NOT_FOUND, 'text not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_text_updated', user_id: access.user_id, context: { dictionary_id: dictionary.id, text_id, via: access.via } })
  return json({ text: add_audio_download_urls({ text: result.text, origin: event.url.origin, dict_id: dictionary.id }) } satisfies V1TextResponseBody)
}

/**
 * DELETE /api/v1/dictionaries/[id]/texts/[textId] — delete the text AND its
 * sentences. Editor+.
 */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const text_id = event.params.textId
  if (!text_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing text id')

  const result = apply_text_delete({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), text_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'text not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_text_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, text_id, via: access.via } })
  return json({ result: 'deleted' } satisfies V1TextDeleteResponseBody)
}
