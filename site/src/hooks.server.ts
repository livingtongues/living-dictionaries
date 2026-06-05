import { get_shared_db } from '$lib/db/server/shared-db'

// Force shared.db open + SQL migrations at server boot rather than lazily on the
// first request (avoids a fresh container racing a migration inside a live
// request). The handle below stays a pass-through.
get_shared_db()

/** @type {import('@sveltejs/kit').Handle} */
export function handle({ event, resolve }) {
  return resolve(event)
}
