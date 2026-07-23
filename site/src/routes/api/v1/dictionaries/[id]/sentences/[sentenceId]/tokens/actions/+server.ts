import type { RequestHandler } from './$types'
import type { SentenceRecord } from '$lib/db/server/v1-entry-write'
import type { TokenActionInput } from '$lib/db/server/v1-suggestions'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { read_sentence_record } from '$lib/db/server/v1-entry-write'
import { apply_token_actions } from '$lib/db/server/v1-suggestions'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1SentenceTokenActionsRequestBody {
  /**
   * Review actions applied to this sentence's tokens in order. `confirm`
   * requires `entry_id` (optionally `sense_id` — confirmed sense links mirror
   * into `senses_in_sentences`); `ignore` marks the occurrence ignored;
   * `unlink` returns it to unmatched (dropping a stale junction row on text
   * sentences). Gold IGT gloss/morphemes always survive.
   */
  actions: TokenActionInput[]
}

export interface V1SentenceTokenActionsResponseBody {
  sentence: SentenceRecord
}

/** POST /api/v1/dictionaries/[id]/sentences/[sentenceId]/tokens/actions — per-token review actions. Editor+ / write key. */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const sentence_id = event.params.sentenceId
  if (!sentence_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing sentence id')

  const body = await event.request.json() as V1SentenceTokenActionsRequestBody
  if (!Array.isArray(body.actions) || !body.actions.length)
    error(ResponseCodes.BAD_REQUEST, 'actions array is required')

  const db = get_dictionary_db(dictionary.id)
  let result
  try {
    result = apply_token_actions({
      db,
      history_db: get_dictionary_history_db(dictionary.id),
      sentence_id,
      actions: body.actions,
      user_id: access.user_id,
      api_key_id: access.key_id ?? null,
    })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found)
    error(ResponseCodes.NOT_FOUND, 'sentence not found')

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_sentence_token_actions', user_id: access.user_id, context: { dictionary_id: dictionary.id, sentence_id, actions: body.actions.length, via: access.via } })

  const sentence = read_sentence_record(db, sentence_id)
  if (!sentence)
    error(ResponseCodes.NOT_FOUND, 'sentence not found')
  return json({ sentence } satisfies V1SentenceTokenActionsResponseBody)
}
