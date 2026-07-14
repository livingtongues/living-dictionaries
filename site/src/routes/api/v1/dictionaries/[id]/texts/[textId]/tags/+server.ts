import type { RequestHandler } from './$types'
import type { TextTagView } from '$lib/db/server/v1-texts'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { link_text_tag, list_text_tags } from '$lib/db/server/v1-texts'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1TextTagsGetResponseBody { tags: TextTagView[] }
export interface V1TextTagPostRequestBody { name: string, kind?: string | null, code?: string | null }
export interface V1TextTagPostResponseBody { tag: TextTagView, created: boolean }

/** GET …/texts/[textId]/tags — the text's classification tags. */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  const text_id = event.params.textId
  if (!text_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing text id')
  return json({ tags: list_text_tags(get_dictionary_db(dictionary.id), text_id) } satisfies V1TextTagsGetResponseBody)
}

/** POST …/texts/[textId]/tags — attach a classification tag (find-or-create). Editor+. */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const text_id = event.params.textId
  if (!text_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing text id')
  const { name, kind, code } = await event.request.json() as V1TextTagPostRequestBody
  let result
  try {
    result = link_text_tag({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), text_id, name, kind, code, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (!result.found || !result.tag)
    error(ResponseCodes.NOT_FOUND, 'text not found')
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  log_server_event({ level: 'info', message: 'v1_text_tag_linked', user_id: access.user_id, context: { dictionary_id: dictionary.id, text_id, tag_id: result.tag.id, created: result.created, via: access.via } })
  return json({ tag: result.tag, created: result.created } satisfies V1TextTagPostResponseBody)
}
