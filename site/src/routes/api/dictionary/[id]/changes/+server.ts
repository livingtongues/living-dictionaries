import type { RequestHandler } from './$types'
import type { DictChangesRequest, DictChangesResponse } from '$lib/db/server/dictionary-sync-helpers'
import { verify_auth } from '$lib/auth/verify'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes, SNAPSHOT_EXPIRED_DAYS } from '$lib/constants'
import { get_dictionary_db, LATEST_DICT_MIGRATION, read_last_modified_at } from '$lib/db/server/dictionary-db'
import { get_shared_db } from '$lib/db/server/shared-db'
import { process_dict_changes, strip_sql_ext } from '$lib/db/server/dictionary-sync-helpers'
import { error, json } from '@sveltejs/kit'

export type { DictChangesRequest, DictChangesResponse }

const DAY_MS = 24 * 60 * 60 * 1000

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
  const dict_id = event.params.id
  if (!dict_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id')

  const body = await event.request.json() as DictChangesRequest

  // Resolve caller. Anonymous viewers are OK (they get pull-only).
  const caller = await resolve_caller(event, dict_id)
  const { user_id, is_editor } = caller

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
  const last_modified_at = read_last_modified_at(dict_db)

  // Fast bail: nothing changed since cursor (Story C.6).
  if (last_modified_at && body.synced_up_to && last_modified_at <= body.synced_up_to) {
    const fast_bail: DictChangesResponse = {
      new_synced_up_to: body.synced_up_to,
      changes: {},
      deletes: [],
    }
    return json(fast_bail)
  }

  // Snapshot expired check (Story C.6).
  if (last_modified_at && body.synced_up_to) {
    const gap_ms = new Date(last_modified_at).getTime() - new Date(body.synced_up_to).getTime()
    if (gap_ms > SNAPSHOT_EXPIRED_DAYS * DAY_MS)
      error(ResponseCodes.GONE, 'snapshot_expired')
  }

  // Process.
  const response = process_dict_changes({
    db: dict_db,
    request: body,
    user_id,
    is_editor,
  })

  // Mirror to shared.db.dictionaries.updated_at + snapshot_uploaded_at gate
  // (Q5 cross-DB cascade). Only when an editor actually pushed something.
  if (is_editor && response.new_synced_up_to !== body.synced_up_to) {
    try {
      const shared = get_shared_db()
      shared.prepare(
        `UPDATE dictionaries SET updated_at = ? WHERE id = ?`,
      ).run(response.new_synced_up_to, dict_id)
    } catch (err) {
      console.warn(`Could not mirror updated_at for ${dict_id}:`, err)
    }
  }

  return json(response)
}

async function resolve_caller(event: Parameters<RequestHandler>[0], dict_id: string): Promise<{ user_id: string, is_editor: boolean }> {
  try {
    const auth = await verify_auth_dict_role(event, dict_id, 'editor')
    return { user_id: auth.user_id, is_editor: true }
  } catch (err) {
    const { status } = err as { status?: number }
    if (status === ResponseCodes.UNAUTHORIZED) {
      // No session at all — viewer (anonymous).
      return { user_id: '', is_editor: false }
    }
    if (status === ResponseCodes.FORBIDDEN) {
      // Has session but no editor role.
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
