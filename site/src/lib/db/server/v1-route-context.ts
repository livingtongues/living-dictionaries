import type { DictApiAccess } from '$lib/auth/verify-dict-api-access'
import type { DictionaryRow } from './get-dictionary'
import type { Cookies } from '@sveltejs/kit'
import { verify_dict_api_access } from '$lib/auth/verify-dict-api-access'
import { ResponseCodes } from '$lib/constants'
import { error } from '@sveltejs/kit'
import { get_dictionary_by_url_or_id } from './get-dictionary'
import { get_shared_db } from './shared-db'

type V1Role = 'contributor' | 'editor' | 'manager'

/**
 * Resolve + auth-gate a `/api/v1/dictionaries/[id]/*` request in one step — the
 * boilerplate every v1 route head repeated: resolve the url-slug-or-id to the
 * canonical dictionary (404 if absent), then verify the caller holds at least
 * `role` (API key OR session). Returns the dictionary row + the access
 * descriptor (`user_id` / `via` for audit + telemetry).
 */
export async function load_v1_dictionary_context({ event, role }: {
  event: { request: Request, cookies?: Pick<Cookies, 'get'>, params: Partial<Record<string, string>> }
  role: V1Role
}): Promise<{ dictionary: DictionaryRow, access: DictApiAccess }> {
  const dictionary = get_dictionary_by_url_or_id(event.params.id ?? '')
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  const access = await verify_dict_api_access(event, dictionary.id, role)
  return { dictionary, access }
}

/**
 * Mirror a dict.db write cursor onto `shared.db.dictionaries.updated_at` so the
 * catalog list + the R2 snapshot builder notice the edit. Best-effort: a mirror
 * failure must NOT fail the write that already committed to dict.db.
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
    get_shared_db().prepare(`UPDATE dictionaries SET updated_at = ? WHERE id = ?`).run(cursor, dict_id)
  } catch (err) {
    console.warn(`Could not mirror updated_at for ${dict_id}:`, err)
  }
}
