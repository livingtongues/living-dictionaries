import type { LayoutServerLoad } from './$types'
import type { AdminLevel } from '$lib/admins'
import { get_admin_level, is_admin } from '$lib/admins'
import { verify_jwt } from '$lib/auth/jwt'
import { get_shared_db } from '$lib/db/server/shared-db'

export interface SsrUser {
  id: string
  email: string | null
  name: string | null
  is_admin: boolean
  /**
   * Tiered admin level — needed at first paint so admin-only UI (settings
   * page, dev-fields) can render correctly on the SSR'd HTML without waiting
   * for `/api/auth/me`. `null` for non-admins.
   */
  admin_level: AdminLevel | null
  /**
   * `users.preferred_locale` — surfaced so the layout can render the right
   * i18n language on first paint without a `/api/auth/me` round-trip.
   * `null` = derive from `Accept-Language` header / locale cookie.
   */
  preferred_locale: string | null
}

/**
 * Resolve the SSR user from the httpOnly `session` cookie so first-paint HTML
 * can render the auth-aware shell. The `lib/auth/user.svelte.ts` AuthUser
 * hydrates from this on the client.
 *
 * Returns minimal display fields only. Richer data (providers, alias list,
 * etc.) loads on demand via `/api/auth/me` or page-specific server loads —
 * keeping this fast.
 *
 * On verify failure (expired token, mismatched secret), the cookie is cleared
 * and we behave as if the user is logged out. This is what makes the "share
 * JWT_SECRET between dev .env and prod" decision safe: a stale cookie just
 * clears itself the next time it's seen.
 */
export const load: LayoutServerLoad = async ({ cookies }) => {
  const token = cookies.get('session')
  if (!token)
    return { ssr_user: null as SsrUser | null }

  try {
    const payload = await verify_jwt(token)
    const row = get_shared_db()
      .prepare('SELECT preferred_locale FROM users WHERE id = ?')
      .get(payload.sub) as { preferred_locale: string | null } | undefined
    const ssr_user: SsrUser = {
      id: payload.sub,
      email: payload.email ?? null,
      name: payload.name ?? null,
      is_admin: is_admin(payload.email),
      admin_level: get_admin_level(payload.email),
      preferred_locale: row?.preferred_locale ?? null,
    }
    return { ssr_user }
  } catch {
    cookies.delete('session', { path: '/' })
    return { ssr_user: null as SsrUser | null }
  }
}
