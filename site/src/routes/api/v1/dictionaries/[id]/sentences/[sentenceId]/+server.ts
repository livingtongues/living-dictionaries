import type { RequestHandler } from './$types'
import type { SentenceRecord } from '$lib/db/server/v1-entry-write'
import type { SentencePatch } from '$lib/api/v1/entry-input'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { apply_sentence_delete, apply_sentence_update, read_sentence_record } from '$lib/db/server/v1-entry-write'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1SentenceUpdateResponseBody {
  sentence: SentenceRecord
}

export interface V1SentenceDeleteResponseBody {
  result: 'deleted'
}

/** GET — read any sentence by id, including standalone grammar examples. */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })

  const sentence_id = event.params.sentenceId
  if (!sentence_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing sentence id')

  const sentence = read_sentence_record(get_dictionary_db(dictionary.id), sentence_id)
  if (!sentence)
    error(ResponseCodes.NOT_FOUND, 'sentence not found')
  return json({ sentence } satisfies V1SentenceUpdateResponseBody)
}

/**
 * PATCH /api/v1/dictionaries/[id]/sentences/[sentenceId]
 *
 * Field-merge one example sentence's `text` / `translation` — the surgical
 * single-sentence edit (e.g. fixing an OCR typo). Editor+.
 */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const sentence_id = event.params.sentenceId
  if (!sentence_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing sentence id')

  const patch = await event.request.json() as SentencePatch
  const db = get_dictionary_db(dictionary.id)

  let result
  try {
    result = apply_sentence_update({ db, history_db: get_dictionary_history_db(dictionary.id), sentence_id, patch, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'sentence not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_sentence_updated', user_id: access.user_id, context: { dictionary_id: dictionary.id, sentence_id, via: access.via } })

  const sentence = read_sentence_record(db, sentence_id)
  if (!sentence)
    error(ResponseCodes.NOT_FOUND, 'sentence not found')
  return json({ sentence } satisfies V1SentenceUpdateResponseBody)
}

/**
 * DELETE /api/v1/dictionaries/[id]/sentences/[sentenceId]
 *
 * Delete one example sentence (FK cascade sweeps its sense junctions). Editor+.
 */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const sentence_id = event.params.sentenceId
  if (!sentence_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing sentence id')

  const result = apply_sentence_delete({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), sentence_id, user_id: access.user_id, api_key_id: access.key_id ?? null })
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'sentence not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_sentence_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, sentence_id, via: access.via } })

  return json({ result: 'deleted' } satisfies V1SentenceDeleteResponseBody)
}
