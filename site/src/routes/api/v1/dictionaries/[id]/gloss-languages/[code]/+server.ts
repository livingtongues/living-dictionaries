import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { remove_gloss_language } from '$lib/db/server/gloss-languages'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1GlossLanguageDeleteResponseBody {
  gloss_languages: string[]
}

/**
 * DELETE /api/v1/dictionaries/[id]/gloss-languages/[code] — remove a gloss
 * language. Refused while any sense/sentence still stores text under it.
 */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const code = event.params.code ?? ''
  let gloss_languages: string[]
  try {
    gloss_languages = remove_gloss_language({ dict_id: dictionary.id, user_id: access.user_id, code })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  log_server_event({ level: 'info', message: 'v1_gloss_language_removed', user_id: access.user_id, context: { dictionary_id: dictionary.id, code, via: access.via } })
  return json({ gloss_languages } satisfies V1GlossLanguageDeleteResponseBody)
}
