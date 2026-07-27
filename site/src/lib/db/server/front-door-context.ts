import type { FrontDoorContext } from '$lib/api/v1/front-door'
import { API_KEY_PREFIX, verify_api_key } from '$lib/api-keys/api-key'
import { get_shared_db } from './shared-db'
import { get_dictionary_by_url_or_id } from './get-dictionary'

/**
 * Resolve an OPTIONAL API key on `GET /api/v1` into the context that personalizes
 * the front door (which dictionary, what scope, and what work is waiting).
 *
 * Deliberately never throws or 401s: agents paste expired, revoked, and outright
 * junk keys, and the front door must still hand them the task menu. A bad key
 * simply yields `null` → the anonymous doc.
 */
export function load_front_door_context(request: Request): FrontDoorContext | null {
  const auth_header = request.headers.get('Authorization')
  const bearer = auth_header?.startsWith('Bearer ') ? auth_header.slice('Bearer '.length) : null
  if (!bearer?.startsWith(API_KEY_PREFIX))
    return null

  try {
    const db = get_shared_db()
    const verified = verify_api_key({ db, token: bearer })
    if (!verified)
      return null
    const dictionary = get_dictionary_by_url_or_id(verified.dictionary_id)
    if (!dictionary)
      return null

    const { open_import_conversations } = db.prepare(`
      SELECT COUNT(*) AS open_import_conversations FROM message_threads
      WHERE dictionary_id = ? AND thread_kind = 'import' AND resolved_at IS NULL
    `).get(dictionary.id) as { open_import_conversations: number }

    const { unlinked_files } = db.prepare(`
      SELECT COUNT(*) AS unlinked_files FROM source_files
      WHERE dictionary_id = ? AND source_id IS NULL AND upload_confirmed_at IS NOT NULL
    `).get(dictionary.id) as { unlinked_files: number }

    return {
      dictionary: {
        id: dictionary.id,
        url: dictionary.url,
        name: dictionary.name,
        gloss_languages: dictionary.gloss_languages ?? null,
        entry_count: dictionary.entry_count,
      },
      scope: verified.role,
      open_import_conversations,
      unlinked_files,
    }
  } catch {
    // A personalization failure must never take the front door down.
    return null
  }
}
