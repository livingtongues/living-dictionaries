import type { RequestHandler } from './$types'
import type { Orthography } from '$lib/db/schemas/shared.types'
import type { OrthographyPatch, OrthographyUsage } from '$lib/db/server/orthographies'
import { ResponseCodes } from '$lib/constants'
import { delete_orthography, update_orthography } from '$lib/db/server/orthographies'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export type V1OrthographyPatchRequestBody = OrthographyPatch

export interface V1OrthographyPatchResponseBody {
  orthography: Orthography
}

export interface V1OrthographyDeleteResponseBody {
  deleted: string
  was_using: OrthographyUsage
}

/** PATCH — relabel / set bcp / set notes of an orthography (incl. the primary `default`). Editor+. */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const code = event.params.code ?? ''
  const body = await event.request.json() as V1OrthographyPatchRequestBody
  let orthography: Orthography
  try {
    orthography = update_orthography({ dict_id: dictionary.id, user_id: access.user_id, code, patch: body })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  log_server_event({ level: 'info', message: 'v1_orthography_updated', user_id: access.user_id, context: { dictionary_id: dictionary.id, code, via: access.via } })
  return json({ orthography } satisfies V1OrthographyPatchResponseBody)
}

/** DELETE — remove an alternate orthography; refused while any entry/sentence uses it. Editor+. */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const code = event.params.code ?? ''
  let was_using: OrthographyUsage
  try {
    was_using = delete_orthography({ dict_id: dictionary.id, user_id: access.user_id, code })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  log_server_event({ level: 'info', message: 'v1_orthography_deleted', user_id: access.user_id, context: { dictionary_id: dictionary.id, code, via: access.via } })
  return json({ deleted: code, was_using } satisfies V1OrthographyDeleteResponseBody)
}
