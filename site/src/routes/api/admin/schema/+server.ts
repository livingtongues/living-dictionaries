/**
 * GET → SchemaInfo for one of the server's two SQLite databases.
 *
 *   - `?source=shared`     → the live `shared.db` (users, dictionaries, …).
 *   - `?source=dictionary` → a throwaway in-memory dict DB built from
 *     `dictionary-migrations` (the canonical per-dictionary schema). Row counts
 *     are skipped — the preview DB is always empty.
 *
 * Admin-gated. Loaded client-side by `/admin/schema` via `get_request` (cookie
 * auth rides along automatically).
 */
import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { introspect } from '$lib/db/introspect'
import type { QueryFn, SchemaInfo } from '$lib/db/introspect'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { get_shared_db } from '$lib/db/server/shared-db'

export type AdminSchemaSource = 'shared' | 'dictionary'

export interface AdminSchemaResponseBody {
  schema: SchemaInfo
}

function query_fn(db: { prepare: (sql: string) => { all: (...params: unknown[]) => unknown } }): QueryFn {
  return (sql, params) => Promise.resolve(db.prepare(sql).all(...(params ?? []) as unknown[]) as never)
}

export const GET: RequestHandler = async ({ request, cookies, url }) => {
  const auth = await verify_auth({ request, cookies })
  if (!is_admin(auth.email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const source: AdminSchemaSource = url.searchParams.get('source') === 'dictionary' ? 'dictionary' : 'shared'

  if (source === 'dictionary') {
    const db = open_dictionary_db_in_memory('schema-preview')
    try {
      const schema = await introspect(query_fn(db), 'server dictionary.db', { skip_row_counts: true })
      return json({ schema } satisfies AdminSchemaResponseBody)
    } finally {
      db.close()
    }
  }

  const db = get_shared_db()
  const schema = await introspect(query_fn(db), 'server shared.db')
  return json({ schema } satisfies AdminSchemaResponseBody)
}
