import type { RequestHandler } from './$types'
import type { RelationshipInput, RelationshipView } from '$lib/api/v1/relationship-input'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { apply_relationship_create, list_relationships_for_entry } from '$lib/db/server/v1-relationship-write'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1RelationshipsGetResponseBody {
  relationships: RelationshipView[]
}

export type V1RelationshipPostRequestBody = RelationshipInput

export interface V1RelationshipPostResponseBody {
  relationship: RelationshipView
  created: boolean
}

/**
 * GET /api/v1/dictionaries/[id]/relationships?entry_id=…
 *
 * List every relationship touching an entry (both directions), shaped from that
 * entry's viewpoint (direction + inverse label already resolved). Read access.
 */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })

  const entry_id = event.url.searchParams.get('entry_id')
  if (!entry_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing entry_id query param')

  const relationships = list_relationships_for_entry(get_dictionary_db(dictionary.id), entry_id)
  return json({ relationships } satisfies V1RelationshipsGetResponseBody)
}

/**
 * POST /api/v1/dictionaries/[id]/relationships
 *
 * Create a typed relationship between two entries (optionally narrowed to senses).
 * Idempotent: an identical relationship returns the existing row (`created: false`).
 * Editor+.
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const input = await event.request.json() as V1RelationshipPostRequestBody
  const db = get_dictionary_db(dictionary.id)

  let result
  try {
    result = apply_relationship_create({ db, history_db: get_dictionary_history_db(dictionary.id), input, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }

  if (result.created) {
    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
    log_server_event({ level: 'info', message: 'v1_relationship_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, relationship_id: result.relationship.id, via: access.via } })
  }

  return json({ relationship: result.relationship, created: result.created } satisfies V1RelationshipPostResponseBody)
}
