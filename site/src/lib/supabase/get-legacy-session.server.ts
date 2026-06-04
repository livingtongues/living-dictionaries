import type { Supabase } from '.'
import type { Cookies } from '@sveltejs/kit'
import { verify_jwt } from '$lib/auth/jwt'
import { get_shared_db } from '$lib/db/server/shared-db'
import { resolve_admin_level } from '$lib/server/resolve-admin-level'

interface UserRow {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
}

/**
 * M4-auth compat shim. The legacy write/media/email API endpoints
 * (`db/create-dictionary`, `db/delete-dictionary`, `email/invite`,
 * `email/new_user`, `gcs_serving_url`, `upload`) still consume the old
 * Supabase `AuthResponse` shape via `locals.getSession()`. Rather than rewrite
 * those endpoints during the auth-only milestone (they belong to M4-write /
 * M4-media), this rebuilds that shape from the REAL session-cookie JWT +
 * shared.db so their identity / admin gating is real. Server-only
 * (`.server.ts`) — never bundled to the client.
 */
export async function get_legacy_session({ supabase, cookies }: { supabase: Supabase, cookies: Pick<Cookies, 'get'> }) {
  const logged_out = { data: { user: null, session: null }, error: null }
  const token = cookies.get('session')
  if (!token)
    return logged_out

  try {
    const { sub } = await verify_jwt(token)
    const row = get_shared_db()
      .prepare('SELECT id, email, name, avatar_url FROM users WHERE id = ?')
      .get(sub) as UserRow | undefined
    if (!row)
      return logged_out

    const admin = resolve_admin_level({ email: row.email, cookies }) ?? 0
    const user = {
      id: row.id,
      email: row.email ?? undefined,
      app_metadata: { admin },
      user_metadata: { full_name: row.name ?? '', avatar_url: row.avatar_url ?? '' },
    }
    return { data: { user, session: { user, access_token: token } }, error: null }
  } catch {
    return logged_out
  }
}
