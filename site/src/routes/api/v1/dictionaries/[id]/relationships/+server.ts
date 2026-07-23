import type { RequestHandler } from './$types'
import type { RelationshipInput, RelationshipView } from '$lib/api/v1/relationship-input'
import type { RelationshipWriteResult } from '$lib/db/server/v1-relationship-write'
import { MAX_ENTRIES_PER_REQUEST } from '$lib/api/v1/entry-input'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { apply_relationship_batch, apply_relationship_create, list_relationships_for_entry } from '$lib/db/server/v1-relationship-write'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1RelationshipsGetResponseBody {
  relationships: RelationshipView[]
}

export type V1RelationshipPostRequestBody = RelationshipInput | RelationshipInput[] | { relationships: RelationshipInput[] }

export interface V1RelationshipPostResponseBody {
  relationship: RelationshipView
  created: boolean
}

export interface V1RelationshipsBatchResponseBody {
  created: number
  /** Items that were idempotent no-ops (an identical relationship already existed). */
  existed: number
  failed: number
  results: RelationshipWriteResult[]
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
 * Create typed relationships between entries (optionally narrowed to senses).
 * Body accepts ONE relationship object (response: `{ relationship, created }`),
 * or a batch — a bare array or `{ relationships: [...] }` (≤1000/request;
 * response: `{ created, existed, failed, results }` with per-item results in
 * input order). Idempotent either way: an identical relationship is a no-op
 * (`created: false` / status `exists`). Editor+.
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const body = await event.request.json() as V1RelationshipPostRequestBody
  const db = get_dictionary_db(dictionary.id)

  const batch = normalize_batch(body)
  if (batch) {
    if (!batch.length)
      error(ResponseCodes.BAD_REQUEST, 'no relationships provided')
    if (batch.length > MAX_ENTRIES_PER_REQUEST)
      error(ResponseCodes.BAD_REQUEST, `too many relationships in one request (max ${MAX_ENTRIES_PER_REQUEST}); split into batches`)

    let report
    try {
      report = apply_relationship_batch({ db, history_db: get_dictionary_history_db(dictionary.id), relationships: batch, user_id: access.user_id, api_key_id: access.key_id ?? null })
    } catch (err) {
      log_server_event({ level: 'error', message: 'v1_relationships_batch_failed', error: err, user_id: access.user_id, context: { dictionary_id: dictionary.id, via: access.via } })
      error(ResponseCodes.INTERNAL_SERVER_ERROR, `batch failed: ${(err as Error).message}`)
    }

    if (report.created)
      mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: report.cursor })
    log_server_event({ level: 'info', message: 'v1_relationships_batch', user_id: access.user_id, context: { dictionary_id: dictionary.id, via: access.via, created: report.created, existed: report.existed, failed: report.failed } })

    const { created, existed, failed, results } = report
    return json({ created, existed, failed, results } satisfies V1RelationshipsBatchResponseBody)
  }

  let result
  try {
    result = apply_relationship_create({ db, history_db: get_dictionary_history_db(dictionary.id), input: body as RelationshipInput, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }

  if (result.created) {
    mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
    log_server_event({ level: 'info', message: 'v1_relationship_created', user_id: access.user_id, context: { dictionary_id: dictionary.id, relationship_id: result.relationship.id, via: access.via } })
  }

  return json({ relationship: result.relationship, created: result.created } satisfies V1RelationshipPostResponseBody)
}

/** Batch bodies: a bare array, or `{ relationships: [...] }`. A single object → null (single path). */
function normalize_batch(body: V1RelationshipPostRequestBody): RelationshipInput[] | null {
  if (Array.isArray(body))
    return body
  if (body && typeof body === 'object' && 'relationships' in body && Array.isArray((body as { relationships: unknown }).relationships))
    return (body as { relationships: RelationshipInput[] }).relationships
  return null
}
