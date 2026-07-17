import type { RequestHandler } from './$types'
import type { DictChangesRequest, DictChangesResponse } from '$lib/db/server/dictionary-sync-helpers'
import type Database from 'better-sqlite3'
import { verify_auth } from '$lib/auth/verify'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_dictionary_db, LATEST_DICT_MIGRATION, read_last_modified_at } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { process_dict_changes, read_server_seq_counter, strip_sql_ext } from '$lib/db/server/dictionary-sync-helpers'
import { mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export type { DictChangesRequest, DictChangesResponse }

/** Highest tombstone seq the snapshot builder has pruned, or null if never pruned. */
function read_pruned_up_to_seq(db: Database.Database): number | null {
  const row = db.prepare(`SELECT value FROM db_metadata WHERE key = 'pruned_up_to_seq'`).get() as { value: string } | undefined
  if (!row?.value)
    return null
  const seq = Number(row.value)
  return Number.isFinite(seq) ? seq : null
}

/**
 * POST /api/dictionary/[id]/changes
 *
 * Push + pull in one atomic round-trip (Story B.3).
 *
 * Editors push dirty rows + tombstones; viewers (anonymous or no-role) send
 * an empty `dirty_rows` / `deletes` and just pull deltas since their cursor.
 *
 * Returns sentinel errors:
 *   409 `schema_outdated` — client_migration < server_migration; client reloads.
 *   503 `server_outdated` — server_migration < client_migration; client retries shortly.
 *   410 `snapshot_expired` — cursor > 60 days behind; client refetches snapshot.
 *   403 `role_revoked` — caller had editor role at fetch time, lost it now.
 */
export const POST: RequestHandler = async (event) => {
  const dict_id_or_url = event.params.id
  if (!dict_id_or_url)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id')

  // Resolve url-slug → canonical id so the dict.db file, role lookup, and the
  // shared.db mirror all key on the same id (LD dicts can have url !== id).
  const dictionary = get_dictionary_by_url_or_id(dict_id_or_url)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  const dict_id = dictionary.id

  const body = await event.request.json() as DictChangesRequest

  // Resolve caller. Anonymous viewers are OK (they get pull-only) — except on a
  // secure dictionary, where non-members get the same 404 as an unknown id.
  const caller = await resolve_caller(event, dictionary)
  const { user_id, is_editor } = caller

  // Does this editor have rows/tombstones to PUSH this round?
  const has_push = is_editor && (
    Object.values(body.dirty_rows ?? {}).some(rows => rows && rows.length)
    || (body.deletes?.length ?? 0) > 0
  )

  // Migration version handshake (Q10.3 / B.3 error sentinels).
  const client_migration = strip_sql_ext(body.latest_dict_migration ?? '')
  const server_migration = strip_sql_ext(LATEST_DICT_MIGRATION)
  if (client_migration && client_migration !== server_migration) {
    if (client_migration < server_migration)
      error(ResponseCodes.CONFLICT, 'schema_outdated')
    else
      error(ResponseCodes.SERVICE_UNAVAILABLE, 'server_outdated')
  }

  const dict_db = get_dictionary_db(dict_id)
  const counter = read_server_seq_counter(dict_db)
  const cursor = typeof body.synced_up_to === 'number' ? body.synced_up_to : null

  // Fast bail: nothing to push AND nothing written on the server since cursor.
  // MUST NOT bail when the editor has dirty rows/tombstones to push, or the
  // push is silently dropped (cursor often equals the server watermark).
  if (!has_push && cursor !== null && counter <= cursor) {
    const fast_bail: DictChangesResponse = {
      new_synced_up_to: cursor,
      changes: {},
      deletes: [],
    }
    return json(fast_bail)
  }

  // Snapshot expired check (Story C.6). The snapshot builder prunes tombstones
  // older than SNAPSHOT_EXPIRED_DAYS and records the highest pruned seq in
  // db_metadata.pruned_up_to_seq — a cursor below that may have missed a pruned
  // delete, so the client must refetch a fresh snapshot. Exact replacement for
  // the old date-gap heuristic (cursors are seqs now, not timestamps).
  if (cursor !== null) {
    const pruned_up_to_seq = read_pruned_up_to_seq(dict_db)
    if (pruned_up_to_seq !== null && cursor < pruned_up_to_seq)
      error(ResponseCodes.GONE, 'snapshot_expired')
  }

  // Process. Editor pushes also record change history into the separate
  // per-dict history db (best-effort, appended after the main-db commit).
  let response: DictChangesResponse
  try {
    response = process_dict_changes({
      db: dict_db,
      request: body,
      user_id,
      is_editor,
      history_db: is_editor && has_push ? get_dictionary_history_db(dict_id) : undefined,
    })
  } catch (err) {
    log_server_event({ level: 'error', message: 'dict_changes_failed', error: err, user_id: user_id || null, context: { dictionary_id: dict_id, is_editor, has_push } })
    throw err
  }

  if (has_push) {
    const dirty_count = Object.values(body.dirty_rows ?? {}).reduce((sum, rows) => sum + (rows?.length ?? 0), 0)
    log_server_event({ level: 'info', message: 'dict_changes_pushed', user_id: user_id || null, context: { dictionary_id: dict_id, dirty_rows: dirty_count, deletes: body.deletes?.length ?? 0 } })
  }

  // A dangling child row (its parent was deleted by another editor) was skipped
  // so it couldn't 500 the whole batch. Log which rows/parents so a recurring
  // poison-pill is diagnosable instead of an opaque `FOREIGN KEY constraint failed`.
  if (response.skipped_orphans?.length) {
    log_server_event({ level: 'warn', message: 'dict_changes_orphans_skipped', user_id: user_id || null, context: { dictionary_id: dict_id, orphans: response.skipped_orphans } })
  }

  // Mirror to shared.db.dictionaries.updated_at + refresh entry_count +
  // snapshot_uploaded_at gate (Q5 cross-DB cascade). Only when an editor
  // actually pushed something. The mirror stays an ISO timestamp (it lives in
  // shared.db `dictionaries.updated_at` — the catalog_updated_at_mirror), so it
  // reads the post-write `last_modified_at`, NOT the seq cursor.
  if (is_editor && has_push)
    mirror_dictionary_cursor({ dict_id, cursor: read_last_modified_at(dict_db) })

  return json(response)
}

async function resolve_caller(event: Parameters<RequestHandler>[0], dictionary: { id: string, bucket?: string | null }): Promise<{ user_id: string, is_editor: boolean }> {
  try {
    // Contributor rank counts as the editing tier (matches the client's
    // `can_edit`, which includes contributors).
    const auth = await verify_auth_dict_role(event, { dictionary, min_role: 'contributor' })
    return { user_id: auth.user_id, is_editor: true }
  } catch (err) {
    const { status } = err as { status?: number }
    // Secure dictionary: verify_auth_dict_role answers 404 for anonymous /
    // no-grant callers — propagate it (no anonymous pull-only fallback).
    if (status === ResponseCodes.NOT_FOUND)
      throw err
    if (status === ResponseCodes.UNAUTHORIZED) {
      // No session at all — viewer (anonymous).
      return { user_id: '', is_editor: false }
    }
    if (status === ResponseCodes.FORBIDDEN) {
      // Has session but no editing role.
      try {
        const auth = await verify_auth(event)
        return { user_id: auth.user_id, is_editor: false }
      } catch {
        return { user_id: '', is_editor: false }
      }
    }
    throw err
  }
}
