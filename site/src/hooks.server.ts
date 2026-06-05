import { env } from '$env/dynamic/private'
import { start_r2_snapshot_builder } from '$lib/db/server/r2-snapshot-builder'
import { get_shared_db } from '$lib/db/server/shared-db'

// Force shared.db open + SQL migrations at server boot rather than lazily on the
// first request (avoids a fresh container racing a migration inside a live
// request). The handle below stays a pass-through.
get_shared_db()

// Per-dictionary `dictionaries/{id}.db.gz` snapshot builder. Sweeps every 30 min
// in-process, backs up + gzips + PUTs each changed dict to the public R2
// snapshots bucket (viewers read from there). Gated by R2_SNAPSHOT_BUILDER_ENABLED
// so only the designated builder node runs it (no-op in dev / web nodes).
if (env.R2_SNAPSHOT_BUILDER_ENABLED === 'true')
  start_r2_snapshot_builder()

/** @type {import('@sveltejs/kit').Handle} */
export function handle({ event, resolve }) {
  return resolve(event)
}
