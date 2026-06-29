import type { RequestHandler } from './$types'
import type { SpeakerRecord } from '$lib/db/server/v1-sub-resources'
import { verify_dict_api_access } from '$lib/auth/verify-dict-api-access'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { get_shared_db } from '$lib/db/server/shared-db'
import { create_speaker, list_speakers } from '$lib/db/server/v1-sub-resources'
import { error, json } from '@sveltejs/kit'

export interface V1SpeakersGetResponseBody {
  speakers: SpeakerRecord[]
}

export interface V1SpeakerPostRequestBody {
  name: string
  decade?: number
  gender?: 'm' | 'f' | 'o'
  birthplace?: string
}

export interface V1SpeakerPostResponseBody {
  speaker: SpeakerRecord
}

export const GET: RequestHandler = async (event) => {
  const dictionary = get_dictionary_by_url_or_id(event.params.id)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  await verify_dict_api_access(event, dictionary.id, 'contributor')
  return json({ speakers: list_speakers(get_dictionary_db(dictionary.id)) } satisfies V1SpeakersGetResponseBody)
}

export const POST: RequestHandler = async (event) => {
  const dictionary = get_dictionary_by_url_or_id(event.params.id)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  const access = await verify_dict_api_access(event, dictionary.id, 'editor')

  const input = await event.request.json() as V1SpeakerPostRequestBody
  let result
  try {
    result = create_speaker({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), user_id: access.user_id, input })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  mirror_updated_at(dictionary.id, result.cursor)
  return json({ speaker: result.speaker } satisfies V1SpeakerPostResponseBody)
}

function mirror_updated_at(dict_id: string, cursor: string | null) {
  if (!cursor)
    return
  try {
    get_shared_db().prepare(`UPDATE dictionaries SET updated_at = ? WHERE id = ?`).run(cursor, dict_id)
  } catch (err) {
    console.warn(`Could not mirror updated_at for ${dict_id}:`, err)
  }
}
