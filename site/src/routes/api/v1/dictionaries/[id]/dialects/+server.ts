import type { RequestHandler } from './$types'
import type { DialectRecord } from '$lib/db/server/v1-sub-resources'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { find_or_create_dialect, list_dialects } from '$lib/db/server/v1-sub-resources'
import { error, json } from '@sveltejs/kit'

export interface V1DialectsGetResponseBody {
  dialects: DialectRecord[]
}

export interface V1DialectPostRequestBody {
  name: string
}

export interface V1DialectPostResponseBody {
  dialect: DialectRecord
  created: boolean
}

export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, role: 'contributor' })
  return json({ dialects: list_dialects(get_dictionary_db(dictionary.id)) } satisfies V1DialectsGetResponseBody)
}

export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, role: 'editor' })

  const body = await event.request.json() as V1DialectPostRequestBody
  let result
  try {
    result = find_or_create_dialect({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), user_id: access.user_id, name: body.name })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (result.created)
    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  return json({ dialect: result.dialect, created: result.created } satisfies V1DialectPostResponseBody)
}
