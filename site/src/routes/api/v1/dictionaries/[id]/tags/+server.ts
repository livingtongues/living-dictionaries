import type { RequestHandler } from './$types'
import type { TagRecord } from '$lib/db/server/v1-sub-resources'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { find_or_create_tag, list_tags } from '$lib/db/server/v1-sub-resources'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1TagsGetResponseBody {
  tags: TagRecord[]
}

export interface V1TagPostRequestBody {
  name: string
  private?: boolean
}

export interface V1TagPostResponseBody {
  tag: TagRecord
  created: boolean
}

export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  return json({ tags: list_tags(get_dictionary_db(dictionary.id)) } satisfies V1TagsGetResponseBody)
}

export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const body = await event.request.json() as V1TagPostRequestBody
  let result
  try {
    result = find_or_create_tag({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), user_id: access.user_id, api_key_id: access.key_id ?? null, name: body.name, is_private: body.private })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (result.created) {
    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
    log_server_event({ level: 'info', message: 'v1_tag_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, tag_id: result.tag.id, via: access.via } })
  }
  return json({ tag: result.tag, created: result.created } satisfies V1TagPostResponseBody)
}
