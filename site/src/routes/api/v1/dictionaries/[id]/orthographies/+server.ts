import type { RequestHandler } from './$types'
import type { Orthography } from '$lib/db/schemas/shared.types'
import type { OrthographyInput, OrthographyWithUsage } from '$lib/db/server/orthographies'
import { ResponseCodes } from '$lib/constants'
import { create_orthography, list_orthographies_with_usage, reorder_orthographies } from '$lib/db/server/orthographies'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1OrthographiesGetResponseBody {
  orthographies: OrthographyWithUsage[]
}

export type V1OrthographyPostRequestBody = OrthographyInput

export interface V1OrthographyPostResponseBody {
  orthography: Orthography
}

export interface V1OrthographiesReorderRequestBody {
  /** Every ALTERNATE orthography code, in the desired display order. */
  order: string[]
}

export interface V1OrthographiesReorderResponseBody {
  orthographies: Orthography[]
}

/** GET — list the alternate orthographies + how many entries/sentences use each. */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  return json({ orthographies: list_orthographies_with_usage({ dict_id: dictionary.id }) } satisfies V1OrthographiesGetResponseBody)
}

/** POST — add an alternate orthography. Editor+. */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const body = await event.request.json() as V1OrthographyPostRequestBody
  let orthography: Orthography
  try {
    orthography = create_orthography({ dict_id: dictionary.id, user_id: access.user_id, input: body })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  log_server_event({ level: 'info', message: 'v1_orthography_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, code: orthography.code, via: access.via } })
  return json({ orthography } satisfies V1OrthographyPostResponseBody)
}

/** PUT — reorder the alternate orthographies. Editor+. */
export const PUT: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const body = await event.request.json() as V1OrthographiesReorderRequestBody
  let orthographies: Orthography[]
  try {
    orthographies = reorder_orthographies({ dict_id: dictionary.id, user_id: access.user_id, order: body.order ?? [] })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }
  return json({ orthographies } satisfies V1OrthographiesReorderResponseBody)
}
