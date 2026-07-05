import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { log_server_event } from '$lib/server/log-server-event'
import { dictionary_db_path } from './dictionary-db'
import { get_shared_db } from './shared-db'

/**
 * Reconcile the shared.db catalog against the source-of-truth dict.db files.
 * Fixes two drift classes that the per-write `mirror_dictionary_cursor` can't
 * reach on its own:
 *
 *  1. **`entry_count`** — the cutover stamped it once and only editor/v1 writes
 *     recount it thereafter, so a dictionary never touched since cutover kept a
 *     stale/zero count (e.g. `river` read 0 vs 8693 actual).
 *  2. **`updated_at` running BEHIND the live dict cursor** — the 2026-07-04
 *     featured-stars sweep wrote `featured_entries` straight into every dict.db
 *     (bumping its `db_metadata.last_modified_at`) but never touched the catalog
 *     mirror, so the snapshot builder (keyed on `updated_at > snapshot_uploaded_at`)
 *     never re-snapshotted → fresh viewers sent a stale snapshot cursor and
 *     tripped the 60-day `snapshot_expired` 410 (the empty-dictionary P1).
 *
 * Bumping `updated_at` forward to the dict.db's real `last_modified_at` makes
 * the R2 builder re-snapshot on its next sweep, closing the cursor-vs-snapshot
 * gap. Run at snapshot-builder boot (so a deploy self-heals) and available as an
 * ad-hoc backfill.
 *
 * Opens each dict READ-ONLY with a fresh handle it closes immediately, so it
 * neither thrashes the LRU write-cache in `dictionary-db.ts` nor holds 2000+
 * fds. Best-effort: one dict failing never aborts the pass.
 */
export function reconcile_dictionary_catalog({ shared_db = get_shared_db() }: { shared_db?: Database.Database } = {}): {
  checked: number
  entry_count_fixed: number
  cursor_bumped: number
} {
  const rows = shared_db.prepare(`SELECT id, entry_count, updated_at FROM dictionaries`).all() as {
    id: string
    entry_count: number
    updated_at: string | null
  }[]
  const update = shared_db.prepare(`UPDATE dictionaries SET entry_count = ?, updated_at = ? WHERE id = ?`)
  let entry_count_fixed = 0
  let cursor_bumped = 0

  for (const row of rows) {
    const path = dictionary_db_path(row.id)
    if (!existsSync(path))
      continue
    let dict: Database.Database | null = null
    try {
      dict = new Database(path, { readonly: true })
      const { entry_count } = dict.prepare(`SELECT COUNT(*) AS entry_count FROM entries`).get() as { entry_count: number }
      const last_modified_at = (dict.prepare(`SELECT value FROM db_metadata WHERE key = 'last_modified_at'`).get() as { value: string } | undefined)?.value ?? null

      const count_changed = entry_count !== row.entry_count
      // Only ever move `updated_at` FORWARD — never rewrite history backwards.
      const bump_cursor = !!last_modified_at && (!row.updated_at || last_modified_at > row.updated_at)
      if (count_changed || bump_cursor) {
        update.run(entry_count, bump_cursor ? last_modified_at : row.updated_at, row.id)
        if (count_changed) entry_count_fixed++
        if (bump_cursor) cursor_bumped++
      }
    } catch (err) {
      log_server_event({ level: 'warn', message: 'dict_reconcile_failed', error: err, context: { dictionary_id: row.id } })
    } finally {
      dict?.close()
    }
  }

  return { checked: rows.length, entry_count_fixed, cursor_bumped }
}
