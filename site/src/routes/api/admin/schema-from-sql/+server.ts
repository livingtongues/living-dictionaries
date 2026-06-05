/**
 * POST { sql } → SchemaInfo for a fresh in-memory SQLite DB seeded with the
 * pasted SQL. Lets us point this tool at any other project's schema
 * (house, tutor, scratch experiments) and view it through the same UI.
 *
 * Admin-only. The :memory: DB is fully isolated — no FS write, no network —
 * but the caller still gets to execute arbitrary SQLite, so we keep the gate.
 *
 * Row counts are skipped (paste-source tables are always empty) so the output
 * is deterministic across sources.
 */
import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import Database from 'better-sqlite3'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { introspect } from '$lib/db/introspect'
import type { QueryFn, SchemaInfo } from '$lib/db/introspect'

export interface AdminSchemaFromSqlRequestBody {
  sql: string
  label?: string
}

export interface AdminSchemaFromSqlResponseBody {
  schema: SchemaInfo
}

const MAX_SQL_BYTES = 1_000_000

export const POST: RequestHandler = async ({ request, cookies }) => {
  const auth = await verify_auth({ request, cookies })
  if (!is_admin(auth.email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const body = await request.json() as AdminSchemaFromSqlRequestBody
  if (!body?.sql || typeof body.sql !== 'string')
    error(ResponseCodes.BAD_REQUEST, 'sql required')
  if (body.sql.length > MAX_SQL_BYTES)
    error(ResponseCodes.BAD_REQUEST, `SQL too large (max ${MAX_SQL_BYTES} bytes)`)

  const db = new Database(':memory:')
  try {
    db.exec(body.sql)
    const query: QueryFn = (sql, params) => Promise.resolve(db.prepare(sql).all(...(params ?? []) as unknown[]) as never)
    const schema = await introspect(query, body.label || 'pasted SQL', { skip_row_counts: true })
    return json({ schema } satisfies AdminSchemaFromSqlResponseBody)
  } catch (err) {
    // SvelteKit's `error()` throws an HttpError — let those propagate as-is.
    if (err && typeof err === 'object' && 'status' in err)
      throw err
    error(ResponseCodes.BAD_REQUEST, `SQLite error: ${(err as Error).message}`)
  } finally {
    db.close()
  }
}
