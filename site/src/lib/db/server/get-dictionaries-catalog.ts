import type Database from 'better-sqlite3'
import type { DictionaryView } from '$lib/types'
import { parse_row } from '$lib/db/schemas/json-columns'
import { query_all } from './typed-query'

/**
 * Project a `shared.db` `dictionaries` row (parsed JSON columns) into the legacy
 * `DictionaryView` shape the existing globe / list / footer components consume.
 * Near pass-through: the catalog columns already match the view; we only alias
 * the `*_by_user_id` columns back to the legacy `created_by` / `updated_by`.
 */
function project_to_dictionary_view(row: Record<string, any>): DictionaryView {
  return {
    ...row,
    created_by: row.created_by_user_id ?? null,
    updated_by: row.updated_by_user_id ?? null,
  } as unknown as DictionaryView
}

/** All listed (public) dictionaries — the anonymous homepage globe + footer count. */
export function load_public_dictionaries({ db }: { db: Database.Database }): DictionaryView[] {
  const rows = query_all<Record<string, any>>({
    db,
    table: 'dictionaries',
    sql: 'SELECT * FROM dictionaries WHERE public = 1',
  })
  return rows.map(project_to_dictionary_view)
}

/**
 * Unlisted dictionaries (admin-only globe overlay). Mirrors the legacy query
 * (`public != true AND con_language_description IS NULL`) — excludes constructed
 * languages from the private overlay.
 */
export function load_private_dictionaries({ db }: { db: Database.Database }): DictionaryView[] {
  const rows = query_all<Record<string, any>>({
    db,
    table: 'dictionaries',
    sql: 'SELECT * FROM dictionaries WHERE (public IS NULL OR public != 1) AND con_language_description IS NULL',
  })
  return rows.map(project_to_dictionary_view)
}

/** Every dictionary (admin list view + CSV export). */
export function load_all_dictionaries({ db }: { db: Database.Database }): DictionaryView[] {
  const rows = query_all<Record<string, any>>({
    db,
    table: 'dictionaries',
    sql: 'SELECT * FROM dictionaries',
  })
  return rows.map(project_to_dictionary_view)
}

/**
 * The signed-in user's dictionaries — every catalog row they hold a
 * `dictionary_roles` grant on, projected to `DictionaryView` + their `role`.
 * Backs the homepage "My Dictionaries" personalization.
 */
export function load_dictionaries_for_user({ db, user_id }: { db: Database.Database, user_id: string }): (DictionaryView & { role: string })[] {
  const rows = db.prepare(`
    SELECT dictionaries.*, dictionary_roles.role AS dictionary_role
    FROM dictionary_roles
    INNER JOIN dictionaries ON dictionaries.id = dictionary_roles.dictionary_id
    WHERE dictionary_roles.user_id = ?
  `).all(user_id) as Record<string, any>[]
  return rows.map((row) => {
    const { dictionary_role, ...dictionary } = row
    parse_row('dictionaries', dictionary)
    return { ...project_to_dictionary_view(dictionary), role: dictionary_role }
  })
}
