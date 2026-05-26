import type { Handle } from '@sveltejs/kit'
import { env as private_env } from '$env/dynamic/private'
import { get_dictionary_db, LATEST_DICT_MIGRATION } from '$lib/db/server/dictionary-db'
import { get_shared_db } from '$lib/db/server/shared-db'
import { start_r2_snapshot_builder } from '$lib/db/server/r2-snapshot-builder'

/**
 * Server startup work. SvelteKit imports this file once when the Node adapter
 * boots — perfect place to apply SQL migrations before any request can race
 * a lazily-opened DB. Without this, `get_shared_db()` was lazy (called by the
 * first request that needs the DB), which meant a freshly-deployed container
 * could receive a real inbound request AND run the migration in the same
 * request — and any failure mid-migration would 500 it.
 *
 * Calling `get_shared_db()` here forces the migration pass at module-load
 * time. The shared_db handle is then cached for the lifetime of the process.
 *
 * Pattern + post-mortem carried over from house (`port-shared-bones-from-house.md` L11).
 */
const shared = get_shared_db()

/**
 * Per-dict migration sweep (Q10.1). Query for dicts whose
 * `dict_db_schema_version` is behind the bundled latest and lazy-open each so
 * `get_dictionary_db` applies the pending migrations. Skips when there's
 * nothing to do (zero work on no-migration deploys).
 *
 * Runs in `queueMicrotask` so a slow sweep can't block request handling — the
 * lazy path in `get_dictionary_db` is the safety net for any dict that gets
 * touched mid-sweep.
 */
const dicts_needing_migration = shared.prepare(`
  SELECT id FROM dictionaries
  WHERE dict_db_schema_version IS NULL
     OR dict_db_schema_version < ?
`).all(LATEST_DICT_MIGRATION) as { id: string }[]

if (dicts_needing_migration.length > 0) {
  console.info(`[hooks.server] ${dicts_needing_migration.length} dictionary/dictionaries need migration to ${LATEST_DICT_MIGRATION}`)
  queueMicrotask(() => {
    for (const { id } of dicts_needing_migration) {
      try {
        get_dictionary_db(id)
      } catch (err) {
        console.error(`[hooks.server] migration apply failed for ${id}:`, err)
      }
    }
    console.info(`[hooks.server] per-dict migration sweep complete.`)
  })
}

/**
 * Per-dictionary `dictionaries/{id}.db.gz` snapshot builder. Runs every 30
 * min in-process, queries `shared.db.dictionaries WHERE updated_at >
 * snapshot_uploaded_at`, runs `db.backup()` → gzip → R2 PUT for each changed
 * dict. Gated by `R2_SNAPSHOT_BUILDER_ENABLED` env var (cutover-day kill
 * switch — see Story C.2 in port-db-sync-architecture.md).
 */
if (private_env.R2_SNAPSHOT_BUILDER_ENABLED === 'true')
  start_r2_snapshot_builder()

export const handle: Handle = ({ event, resolve }) => {
  return resolve(event)
}
