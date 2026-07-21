import type { RequestHandler } from './$types'
import type { TextCreateInput, TextRecord, TextSummary } from '$lib/db/server/v1-texts'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { add_audio_download_urls, create_text, list_texts } from '$lib/db/server/v1-texts'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1TextsGetResponseBody {
  texts: TextSummary[]
}

export type V1TextPostRequestBody = TextCreateInput

export interface V1TextPostResponseBody {
  text: TextRecord
  /** false → a text with the supplied `id` already existed (idempotent no-op). */
  created: boolean
}

/** GET /api/v1/dictionaries/[id]/texts — list texts, optionally filtered by exact tag name. */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  return json({ texts: list_texts(get_dictionary_db(dictionary.id), { tag: event.url.searchParams.get('tag') ?? undefined }) } satisfies V1TextsGetResponseBody)
}

/**
 * POST /api/v1/dictionaries/[id]/texts — create a text with ordered sentences.
 * Supply your own `id` (UUID) for idempotency: a re-POST of an existing id is a
 * no-op (`created: false`). Editor+ / write key.
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const input = await event.request.json() as V1TextPostRequestBody
  let result
  try {
    result = create_text({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), user_id: access.user_id, api_key_id: access.key_id ?? null, input })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (result.created)
    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  log_server_event({ level: 'info', message: 'v1_text_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, text_id: result.text.id, created: result.created, via: access.via } })
  return json({ text: add_audio_download_urls({ text: result.text, origin: event.url.origin, dict_id: dictionary.id }), created: result.created } satisfies V1TextPostResponseBody)
}
