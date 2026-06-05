/**
 * Run `introspect()` against the browser-local wa-sqlite `admin.db` — the
 * admin sync mirror of the server's `shared.db`. Lets you spot client/server
 * drift between what the bundled migrations create locally and what the server
 * shared.db actually has.
 *
 * Browser-only — gated by `if (browser)` at the call site. Reuses the singleton
 * connection opened by `$lib/db/client/db`.
 */
import type { SchemaInfo } from '$lib/db/introspect'
import { get_admin_db } from '$lib/db/client/db'
import { introspect } from '$lib/db/introspect'

export async function introspect_admin_local_db(user_id: string): Promise<SchemaInfo> {
  const { connection } = await get_admin_db(user_id)
  return introspect(connection.query, 'local admin.db')
}
