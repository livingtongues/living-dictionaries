import type { RequestHandler } from './$types'
import type { TagRecord } from '$lib/db/server/v1-sub-resources'
import { verify_dict_api_access } from '$lib/auth/verify-dict-api-access'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { get_shared_db } from '$lib/db/server/shared-db'
import { find_or_create_tag, list_tags } from '$lib/db/server/v1-sub-resources'
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
  const dictionary = get_dictionary_by_url_or_id(event.params.id)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  await verify_dict_api_access(event, dictionary.id, 'contributor')
  return json({ tags: list_tags(get_dictionary_db(dictionary.id)) } satisfies V1TagsGetResponseBody)
}

export const POST: RequestHandler = async (event) => {
  const dictionary = get_dictionary_by_url_or_id(event.params.id)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  const access = await verify_dict_api_access(event, dictionary.id, 'editor')

  const body = await event.request.json() as V1TagPostRequestBody
  let result
  try {
    result = find_or_create_tag({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), user_id: access.user_id, name: body.name, is_private: body.private })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  if (result.created && result.cursor) {
    try {
      get_shared_db().prepare(`UPDATE dictionaries SET updated_at = ? WHERE id = ?`).run(result.cursor, dictionary.id)
    } catch (err) {
      console.warn(`Could not mirror updated_at for ${dictionary.id}:`, err)
    }
  }
  return json({ tag: result.tag, created: result.created } satisfies V1TagPostResponseBody)
}
