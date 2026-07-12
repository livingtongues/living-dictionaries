import type { ApiAccess, DictApiAccess } from '$lib/auth/verify-dict-api-access'
import type { DictionaryRow } from './get-dictionary'
import type { Cookies } from '@sveltejs/kit'
import { verify_dict_api_access } from '$lib/auth/verify-dict-api-access'
import { ResponseCodes } from '$lib/constants'
import { log_server_event } from '$lib/server/log-server-event'
import { error } from '@sveltejs/kit'
import { get_dictionary_db } from './dictionary-db'
import { get_dictionary_by_url_or_id } from './get-dictionary'
import { get_shared_db } from './shared-db'

/**
 * Resolve + auth-gate a `/api/v1/dictionaries/[id]/*` request in one step — the
 * boilerplate every v1 route head repeated: resolve the url-slug-or-id to the
 * canonical dictionary (404 if absent), then verify the caller holds the
 * required `access` (API key scope OR — for a logged-in human — the mapped
 * dictionary role). Returns the dictionary row + the access descriptor
 * (`user_id` / `via` / `key_id` for audit + telemetry). `access` defaults to
 * `write` so an un-annotated route fails closed.
 */
export async function load_v1_dictionary_context({ event, access }: {
  event: { request: Request, cookies?: Pick<Cookies, 'get'>, params: Partial<Record<string, string>> }
  access: ApiAccess
}): Promise<{ dictionary: DictionaryRow, access: DictApiAccess }> {
  const dictionary = get_dictionary_by_url_or_id(event.params.id ?? '')
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  const resolved = await verify_dict_api_access(event, dictionary, access)
  return { dictionary, access: resolved }
}

/**
 * Mirror a dict.db write cursor onto `shared.db.dictionaries.updated_at` (and
 * refresh the denormalized `entry_count`) so the catalog list + the R2 snapshot
 * builder notice the edit. Called after EVERY dict write — both the v1 write
 * routes and the `/api/dictionary/[id]/changes` editor push. Best-effort: a
 * mirror failure must NOT fail the write that already committed to dict.db.
 *
 * `entry_count` has no other maintainer (the cutover import stamps it once);
 * the unconditional recount here is sub-ms even at 50k entries.
 *
 * WATERMARK VOCABULARY — `cursor` here is the **dict_content_cursor** produced by
 * `process_dict_changes` / the v1 write helpers (a per-dict `db_metadata.last_modified_at`).
 * Copying it onto `shared.db.dictionaries.updated_at` produces the
 * **catalog_updated_at_mirror**: the shared.db column that both the catalog-list
 * `admin_catalog_cursor` sync (`sync-helpers.ts`) and the snapshot builder
 * (`r2-snapshot-builder.ts`, `updated_at > snapshot_uploaded_at`) read. It is a
 * mirror, not an independent watermark — don't confuse it with either sync cursor.
 */
export function mirror_dictionary_cursor({ dict_id, cursor }: { dict_id: string, cursor: string | null }): void {
  if (!cursor)
    return
  try {
    const { entry_count } = get_dictionary_db(dict_id)
      .prepare(`SELECT COUNT(*) AS entry_count FROM entries`)
      .get() as { entry_count: number }
    get_shared_db()
      .prepare(`UPDATE dictionaries SET updated_at = ?, entry_count = ? WHERE id = ?`)
      .run(cursor, entry_count, dict_id)
  } catch (err) {
    console.warn(`Could not mirror updated_at for ${dict_id}:`, err)
    log_server_event({ level: 'warn', message: 'dict_mirror_failed', error: err, context: { dictionary_id: dict_id } })
  }
}
