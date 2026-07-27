import type Database from 'better-sqlite3'
import { validate_orthographies_array } from './orthographies'

/**
 * The one writer of `shared.db.dictionaries` catalog metadata — shared by the
 * human settings/about path (`/api/dictionaries/[id]/catalog`) and the
 * agent-facing `PATCH /api/v1/dictionaries/[id]`. Both surfaces must apply the
 * SAME allowlist and the SAME validation, per the human/agent editing-parity
 * direction; putting the column list in one place is what keeps them honest.
 *
 * Deliberately does NOT set `dirty`. That is a CLIENT-only flag ("this browser
 * holds an edit it still has to push"); what carries a server-side write down to
 * admin clients is the `server_seq` trigger, which fires on EVERY update. See
 * the canonical-row rule in `sync-helpers.ts`.
 */

/** Catalog columns stored as JSON — values are stringified on write. */
const JSON_FIELDS = new Set([
  'alternate_names', 'gloss_languages', 'coordinates', 'metadata',
  'orthographies', 'featured_image', 'write_in_collaborators',
])

/** Catalog columns stored as plain scalars. */
const SCALAR_FIELDS = new Set([
  'name', 'url', 'location', 'iso_639_3', 'glottocode', 'copyright',
  'author_connection', 'community_permission', 'con_language_description',
  'about', 'citation', 'public', 'print_access',
  'language_used_by_community', 'hide_living_tongues_logo',
])

/** Everything a dictionary MANAGER may edit from the human UI. */
export const CATALOG_FIELDS: ReadonlySet<string> = new Set([...JSON_FIELDS, ...SCALAR_FIELDS])

/**
 * Fields the agent-facing v1 PATCH deliberately refuses, each because a better
 * door already exists or because the decision isn't an agent's to make:
 *   - `gloss_languages` / `orthographies` / `featured_image` → dedicated v1
 *     routes with their own validation + media handling.
 *   - `metadata` → legacy catch-all blob, no schema to validate against.
 *   - `public` / `print_access` → publication is a human call. An agent that
 *     thinks a dictionary is ready should ASK on the conversation, not flip it.
 */
const V1_EXCLUDED_FIELDS = new Set([
  'gloss_languages', 'orthographies', 'featured_image', 'metadata',
  'public', 'print_access',
])

/** What `PATCH /api/v1/dictionaries/[id]` may write. */
export const V1_CATALOG_FIELDS: ReadonlySet<string> = new Set(
  [...CATALOG_FIELDS].filter(field => !V1_EXCLUDED_FIELDS.has(field)),
)

export class CatalogFieldError extends Error {}

/**
 * Apply a partial `{ field: value }` catalog update. Throws `CatalogFieldError`
 * for a field outside `allowed` or an invalid value — callers map that to a 400.
 * Returns the number of rows written (0 = unknown dictionary id).
 */
export function update_dictionary_catalog({ db, dictionary_id, fields, user_id, allowed = CATALOG_FIELDS }: {
  db: Database.Database
  dictionary_id: string
  fields: Record<string, unknown>
  user_id: string
  allowed?: ReadonlySet<string>
}): number {
  const keys = Object.keys(fields)
  if (keys.length === 0)
    throw new CatalogFieldError('No fields to update')

  for (const key of keys) {
    if (!allowed.has(key)) {
      const reason = CATALOG_FIELDS.has(key)
        ? `Field not updatable here: ${key} — see the dedicated endpoint for it`
        : `Field not updatable: ${key}`
      throw new CatalogFieldError(reason)
    }
  }

  if ('orthographies' in fields) {
    try {
      validate_orthographies_array(fields.orthographies)
    } catch (err) {
      throw new CatalogFieldError((err as Error).message)
    }
  }

  const set_clauses: string[] = []
  const values: unknown[] = []
  for (const key of keys) {
    const value = fields[key]
    set_clauses.push(`"${key}" = ?`)
    if (JSON_FIELDS.has(key))
      values.push(value == null ? null : JSON.stringify(value))
    else
      values.push(value ?? null)
  }

  set_clauses.push('updated_at = ?', 'updated_by_user_id = ?')
  values.push(new Date().toISOString(), user_id, dictionary_id)

  const result = db.prepare(`UPDATE dictionaries SET ${set_clauses.join(', ')} WHERE id = ?`).run(...values)
  return result.changes
}

if (import.meta.vitest) {
  describe('catalog field sets', () => {
    test('the v1 set is the human set minus the fields with a better door', () => {
      expect(CATALOG_FIELDS.has('about')).toBe(true)
      expect(V1_CATALOG_FIELDS.has('about')).toBe(true)
      expect(V1_CATALOG_FIELDS.has('citation')).toBe(true)
      expect(V1_CATALOG_FIELDS.has('location')).toBe(true)
      for (const excluded of ['gloss_languages', 'orthographies', 'featured_image', 'metadata', 'public', 'print_access']) {
        expect(CATALOG_FIELDS.has(excluded)).toBe(true)
        expect(V1_CATALOG_FIELDS.has(excluded)).toBe(false)
      }
    })
  })
}
