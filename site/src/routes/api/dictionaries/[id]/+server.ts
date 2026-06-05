import type { RequestHandler } from './$types'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { delete_dictionary_db_file } from '$lib/db/server/dictionary-db'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

/**
 * Full dictionary teardown. SITE-ADMIN ONLY (managers can't delete a whole
 * dictionary). Destructive + irreversible.
 *
 * Steps:
 *   1. shared.db: insert `deletes` tombstones for the dict's child rows
 *      (dictionary_roles / invites / dictionary_partners) and the dictionary
 *      itself. The cascade trigger removes the live rows; admin clients pull the
 *      tombstones on next sync and drop their local copies.
 *   2. Delete the per-dict SQLite file (+ -wal/-shm).
 *
 * NOTE: orphaned-media harvest + R2 snapshot cleanup are DEFERRED with the rest
 * of the R2 work (out this month). Media blobs on the legacy bucket and any R2
 * snapshot are left for a future cleanup sweep.
 */

export interface DictionariesIdDeleteResponseBody {
  result: 'deleted'
  orphaned_media_count: number
  db_files_removed: number
}

export const DELETE: RequestHandler = async (event) => {
  const dict_id = event.params.id
  if (!dict_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id')

  const { email } = await verify_auth(event)
  if (!is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const db = get_shared_db()
  const existing = db.prepare('SELECT id FROM dictionaries WHERE id = ?').get(dict_id) as { id: string } | undefined
  if (!existing)
    error(ResponseCodes.NOT_FOUND, 'Dictionary not found')

  // 1. shared.db tombstones (children first, then the dictionary). Wrapped in a
  // transaction so a partial delete can't leave dangling tombstones.
  const now = new Date().toISOString()
  const tombstone = db.prepare(`INSERT OR REPLACE INTO deletes (table_name, id, updated_at) VALUES (?, ?, ?)`)
  const tombstone_children = db.transaction(() => {
    for (const table of ['dictionary_roles', 'invites', 'dictionary_partners'] as const) {
      const rows = db.prepare(`SELECT id FROM ${table} WHERE dictionary_id = ?`).all(dict_id) as { id: string }[]
      for (const row of rows)
        tombstone.run(table, row.id, now)
    }
    tombstone.run('dictionaries', dict_id, now)
  })
  tombstone_children()

  // 2. Per-dict SQLite file.
  let db_files_removed = 0
  try {
    db_files_removed = delete_dictionary_db_file(dict_id).length
  } catch (err) {
    console.error(`[delete dictionary ${dict_id}] db file removal failed:`, err)
  }

  return json({
    result: 'deleted',
    orphaned_media_count: 0, // deferred with R2/orphaned-media cleanup
    db_files_removed,
  } satisfies DictionariesIdDeleteResponseBody)
}
