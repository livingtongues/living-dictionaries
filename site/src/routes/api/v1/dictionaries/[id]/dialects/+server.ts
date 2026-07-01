import type { RequestHandler } from './$types'
import type { DialectRecord } from '$lib/db/server/v1-sub-resources'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { find_or_create_dialect, list_dialects } from '$lib/db/server/v1-sub-resources'
import { log_server_event } from '$lib/server/log-server-event'
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
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  return json({ dialects: list_dialects(get_dictionary_db(dictionary.id)) } satisfies V1DialectsGetResponseBody)
}

export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const body = await event.request.json() as V1DialectPostRequestBody
  let result
  try {
    result = find_or_create_dialect({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), user_id: access.user_id, api_key_id: access.key_id ?? null, name: body.name })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (result.created) {
    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
    log_server_event({ level: 'info', message: 'v1_dialect_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, dialect_id: result.dialect.id, via: access.via } })
  }
  return json({ dialect: result.dialect, created: result.created } satisfies V1DialectPostResponseBody)
}
