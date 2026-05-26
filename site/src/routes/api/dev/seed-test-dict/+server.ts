import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

/**
 * Dev-only seed endpoint for cross-tab sync verification.
 *
 * Creates (idempotently):
 *   1. A `users` row for the calling dev user.
 *   2. A `dictionaries` row for `dict_id` (defaults to `test-dict-1`).
 *   3. A `dictionary_roles` row granting `editor` to the caller.
 *   4. Lazily opens `dictionaries/{id}.db` so migrations apply.
 *
 * Gated behind `dev` so it 404s in production.
 */

export interface DevSeedTestDictRequestBody {
  dict_id?: string
  dict_name?: string
}

export interface DevSeedTestDictResponseBody {
  dict_id: string
  dict_name: string
  role: 'editor'
}

export const POST: RequestHandler = async (event) => {
  if (!dev)
    error(ResponseCodes.NOT_FOUND, 'dev-only endpoint')

  const { user_id, email } = await verify_auth(event)
  if (!email)
    error(ResponseCodes.BAD_REQUEST, 'seed-test-dict requires a session with an email claim')
  const body = (await event.request.json().catch(() => ({}))) as DevSeedTestDictRequestBody
  const dict_id = body.dict_id || 'test-dict-1'
  const dict_name = body.dict_name || 'Cross-Tab Sync Test Dict'

  const shared = get_shared_db()
  const now = new Date().toISOString()

  // Ensure user row (idempotent — first OTP login already created one, but
  // re-seeding from this endpoint is safe).
  shared.prepare(`
    INSERT INTO users (id, email, name, providers, created_at, updated_at)
    VALUES (?, ?, ?, '[]', ?, ?)
    ON CONFLICT (id) DO UPDATE SET email = excluded.email, updated_at = excluded.updated_at
  `).run(user_id, email, email.split('@')[0], now, now)

  // Ensure dict row.
  shared.prepare(`
    INSERT INTO dictionaries (id, name, public, entry_count, created_at, created_by_user_id, updated_at, updated_by_user_id)
    VALUES (?, ?, 0, 0, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at, updated_by_user_id = excluded.updated_by_user_id
  `).run(dict_id, dict_name, now, user_id, now, user_id)

  // Ensure role row.
  shared.prepare(`
    INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at)
    VALUES (?, ?, ?, 'editor', ?, ?)
    ON CONFLICT (dictionary_id, user_id, role) DO UPDATE SET updated_at = excluded.updated_at
  `).run(crypto.randomUUID(), dict_id, user_id, now, now)

  // Lazy open to apply migrations + populate dict_db_schema_version.
  get_dictionary_db(dict_id)

  return json({ dict_id, dict_name, role: 'editor' } satisfies DevSeedTestDictResponseBody)
}
