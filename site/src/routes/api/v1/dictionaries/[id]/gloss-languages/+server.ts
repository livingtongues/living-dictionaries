import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { add_gloss_language } from '$lib/db/server/gloss-languages'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1GlossLanguagePostRequestBody {
  /** A supported gloss-language code (e.g. `fr`). */
  code: string
}

export interface V1GlossLanguagePostResponseBody {
  gloss_languages: string[]
}

/**
 * POST /api/v1/dictionaries/[id]/gloss-languages — add a gloss language so
 * glosses/translations can be keyed by its code (e.g. importing a
 * French-glossed source into an en/zh dictionary). Manager+ / write key.
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const body = await event.request.json() as V1GlossLanguagePostRequestBody
  let gloss_languages: string[]
  try {
    gloss_languages = add_gloss_language({ dict_id: dictionary.id, user_id: access.user_id, code: body.code })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  log_server_event({ level: 'info', message: 'v1_gloss_language_added', user_id: access.user_id, context: { dictionary_id: dictionary.id, code: body.code, via: access.via } })
  return json({ gloss_languages } satisfies V1GlossLanguagePostResponseBody)
}
