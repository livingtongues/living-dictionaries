import type { RequestHandler } from './$types'
import type { SentenceInput } from '$lib/api/v1/entry-input'
import type { SentenceRecord } from '$lib/db/server/v1-entry-write'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { create_standalone_sentence } from '$lib/db/server/v1-entry-write'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export type V1SentencePostRequestBody = SentenceInput

export interface V1SentencePostResponseBody {
  sentence: SentenceRecord
  /** false when the supplied id already existed (idempotent no-op). */
  created: boolean
}

/** POST — create a sentence without attaching it to a sense or text. */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const input = await event.request.json() as V1SentencePostRequestBody

  let result
  try {
    result = create_standalone_sentence({
      db: get_dictionary_db(dictionary.id),
      history_db: get_dictionary_history_db(dictionary.id),
      input,
      user_id: access.user_id,
      api_key_id: access.key_id ?? null,
    })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }

  if (result.created)
    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  log_server_event({ level: 'info', message: 'v1_sentence_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, sentence_id: result.sentence.id, created: result.created, via: access.via } })
  return json({ sentence: result.sentence, created: result.created } satisfies V1SentencePostResponseBody)
}
