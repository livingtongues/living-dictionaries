import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { apply_import_batch_delete, find_import_batch } from '$lib/db/server/v1-batch-delete'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

const SAMPLE_SIZE = 20

export interface V1EntriesBatchDeleteRequestBody {
  /** The `import_id` used on the original bulk `POST …/entries` (its private tag name). */
  import_id: string
  /** true → report `{ count, sample_entry_ids }` only, NO writes. */
  dry_run?: boolean
  /** Required to arm a real run: the `count` a dry-run just reported. Mismatch → 409. */
  confirm_count?: number
}

export interface V1EntriesBatchDeleteResponseBody {
  import_id: string
  /** Dry-run: entries that WOULD be deleted. Real run: entries actually tombstoned. */
  count: number
  sample_entry_ids: string[]
  deleted: boolean
  /** Real run only: the now-empty private import tag was removed too. */
  tag_deleted?: boolean
}

/**
 * POST /api/v1/dictionaries/[id]/entries/batch-delete
 *
 * Delete every entry from one bulk import (matched via the private tag named
 * after `import_id`). Two-step by design: a `dry_run` reports the blast radius,
 * then the real run must echo that count back as `confirm_count` — a stale or
 * wrong count is rejected (409) so an outdated script can't nuke a re-imported
 * batch. Deletes are sync-safe tombstones (cascade to senses/junctions, peers,
 * history); the emptied private tag is removed too. Orphaned standalone example
 * sentences from the import are left in place. Editor+.
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const body = await event.request.json() as V1EntriesBatchDeleteRequestBody
  const import_id = typeof body.import_id === 'string' ? body.import_id.trim() : ''
  if (!import_id)
    error(ResponseCodes.BAD_REQUEST, 'import_id is required')

  const db = get_dictionary_db(dictionary.id)
  const { tag_id, entry_ids } = find_import_batch(db, import_id)
  if (!tag_id)
    error(ResponseCodes.NOT_FOUND, `no private import tag named '${import_id}' — check the import_id (dictionary tags are case-insensitive)`)

  const count = entry_ids.length
  const sample_entry_ids = entry_ids.slice(0, SAMPLE_SIZE)

  if (body.dry_run)
    return json({ import_id, count, sample_entry_ids, deleted: false } satisfies V1EntriesBatchDeleteResponseBody)

  if (typeof body.confirm_count !== 'number')
    error(ResponseCodes.BAD_REQUEST, `confirm_count is required for a real run — dry_run first, then echo its count (currently ${count})`)
  if (body.confirm_count !== count)
    error(ResponseCodes.CONFLICT, `confirm_count ${body.confirm_count} does not match the live count ${count} — the batch changed since your dry_run; re-check before deleting`)

  let result
  try {
    result = apply_import_batch_delete({ db, history_db: get_dictionary_history_db(dictionary.id), tag_id, entry_ids, user_id: access.user_id, api_key_id: access.key_id ?? null })
  } catch (err) {
    log_server_event({ level: 'error', message: 'v1_batch_delete_failed', error: err, user_id: access.user_id, context: { dictionary_id: dictionary.id, import_id, via: access.via } })
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `batch delete failed: ${(err as Error).message}`)
  }

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.cursor })
  log_server_event({ level: 'info', message: 'v1_batch_delete', user_id: access.user_id, context: { dictionary_id: dictionary.id, import_id, count: result.deleted_count, tag_deleted: result.tag_deleted, via: access.via } })

  return json({ import_id, count: result.deleted_count, sample_entry_ids, deleted: true, tag_deleted: result.tag_deleted } satisfies V1EntriesBatchDeleteResponseBody)
}
