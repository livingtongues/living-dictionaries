import type { InferSelectModel } from 'drizzle-orm'
import type { dictionaries } from '$lib/db/schemas/shared'
import { parse_row } from '$lib/db/schemas/json-columns'
import { get_shared_db } from './shared-db'

export type DictionaryRow = InferSelectModel<typeof dictionaries>

/**
 * Resolve a dictionary catalog row from `shared.db` by its url-slug first,
 * then falling back to its id (legacy URLs used the id directly). Anonymous-
 * safe: every dictionary is URL-reachable; the `public` flag only governs
 * whether it's *listed*, not whether it can be viewed (per the live site).
 *
 * Returns the parsed row (JSON columns hydrated) or `null` if neither a url
 * nor id match exists.
 */
export function get_dictionary_by_url_or_id(url_or_id: string): DictionaryRow | null {
  const db = get_shared_db()

  // Legacy non-ASCII ids exist in both Unicode normalization forms — links in
  // the wild may be NFC while some stored rows are NFD. SQLite compares bytes,
  // so try the candidate in each form.
  const candidates = [...new Set([url_or_id, url_or_id.normalize('NFC'), url_or_id.normalize('NFD')])]

  for (const candidate of candidates) {
    const by_url = db
      .prepare('SELECT * FROM dictionaries WHERE url = ?')
      .get(candidate) as Record<string, unknown> | undefined
    if (by_url)
      return parse_row('dictionaries', by_url) as DictionaryRow
  }

  for (const candidate of candidates) {
    const by_id = db
      .prepare('SELECT * FROM dictionaries WHERE id = ?')
      .get(candidate) as Record<string, unknown> | undefined
    if (by_id)
      return parse_row('dictionaries', by_id) as DictionaryRow
  }

  return null
}
