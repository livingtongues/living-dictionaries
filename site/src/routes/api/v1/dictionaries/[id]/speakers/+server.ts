import type { RequestHandler } from './$types'
import type { SpeakerRecord } from '$lib/db/server/v1-sub-resources'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
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
  const { dictionary } = await load_v1_dictionary_context({ event, role: 'contributor' })
  return json({ speakers: list_speakers(get_dictionary_db(dictionary.id)) } satisfies V1SpeakersGetResponseBody)
}

export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, role: 'editor' })

  const input = await event.request.json() as V1SpeakerPostRequestBody
  let result
  try {
    result = create_speaker({ db: get_dictionary_db(dictionary.id), history_db: get_dictionary_history_db(dictionary.id), user_id: access.user_id, api_key_id: access.key_id ?? null, input })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  return json({ speaker: result.speaker } satisfies V1SpeakerPostResponseBody)
}
