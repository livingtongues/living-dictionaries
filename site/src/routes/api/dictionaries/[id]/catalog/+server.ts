import type { RequestHandler } from './$types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

/**
 * Update a dictionary's catalog metadata in shared.db. Manager-gated (site
 * admins bypass). Used by the dictionary settings page + the about / grammar
 * tabs. Only allowlisted fields are touched; JSON columns are stringified. Sets
 * `dirty = 1` so the admin.db sync engine pulls the change.
 *
 * The caller sends a partial `{ field: value }` — every key must be in
 * ALLOWED_FIELDS or the request is rejected (defense against arbitrary column
 * writes).
 */
const JSON_FIELDS = new Set([
  'alternate_names', 'gloss_languages', 'coordinates', 'metadata',
  'orthographies', 'featured_image', 'write_in_collaborators',
])

const SCALAR_FIELDS = new Set([
  'name', 'url', 'location', 'iso_639_3', 'glottocode', 'copyright',
  'author_connection', 'community_permission', 'con_language_description',
  'about', 'citation', 'grammar', 'public', 'print_access',
  'language_used_by_community', 'hide_living_tongues_logo',
])

const ALLOWED_FIELDS = new Set([...JSON_FIELDS, ...SCALAR_FIELDS])

export type DictionariesCatalogRequestBody = Record<string, unknown>

export interface DictionariesCatalogResponseBody {
  result: 'success'
}

export const POST: RequestHandler = async (event) => {
  const dict_id = event.params.id
  const { user_id } = await verify_auth_dict_role(event, dict_id, 'manager')

  const body = await event.request.json() as DictionariesCatalogRequestBody
  const keys = Object.keys(body)
  if (keys.length === 0)
    error(ResponseCodes.BAD_REQUEST, 'No fields to update')

  for (const key of keys) {
    if (!ALLOWED_FIELDS.has(key))
      error(ResponseCodes.BAD_REQUEST, `Field not updatable: ${key}`)
  }

  const db = get_shared_db()
  const existing = db.prepare('SELECT id FROM dictionaries WHERE id = ?').get(dict_id)
  if (!existing)
    error(ResponseCodes.NOT_FOUND, 'Dictionary not found')

  const set_clauses: string[] = []
  const values: unknown[] = []
  for (const key of keys) {
    const value = body[key]
    set_clauses.push(`"${key}" = ?`)
    if (JSON_FIELDS.has(key))
      values.push(value == null ? null : JSON.stringify(value))
    else
      values.push(value ?? null)
  }

  const now = new Date().toISOString()
  set_clauses.push('updated_at = ?', 'updated_by_user_id = ?', 'dirty = 1')
  values.push(now, user_id, dict_id)

  try {
    db.prepare(`UPDATE dictionaries SET ${set_clauses.join(', ')} WHERE id = ?`).run(...values)
  } catch (err) {
    console.error(`Error updating dictionary catalog: ${(err as Error).message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Could not update dictionary')
  }

  return json({ result: 'success' } satisfies DictionariesCatalogResponseBody)
}
