import type { EffectiveAdminLevel, SiteRole } from '$lib/admins'
import type { Cookies } from '@sveltejs/kit'
import { dev } from '$app/environment'
import { get_admin_level, has_super_manager_role } from '$lib/admins'

export const DEV_ADMIN_LEVEL_COOKIE = 'dev_admin_level'

/**
 * Resolve a user's effective admin level (0-3). Levels 2/3 come from the
 * `$lib/admins.ts` allow-list by email; level 1 (Super Manager) from the
 * `users.roles` DB column containing 'super_manager'. In DEV ONLY, a
 * `dev_admin_level` cookie (`0|1|2|3`) overrides it so a developer can
 * impersonate any admin level without editing the allow-list —
 * re-establishing the old "Set Admin Role Level" dev toggle that used to
 * mutate the mock user's `app_metadata.admin`.
 *
 * Strictly dev-gated (`dev` is compiled to `false` in prod builds), so a
 * forged cookie has no effect in production. Applied at every server-side
 * admin resolution point: root `+layout.server.ts` (ssr_user), `/api/auth/me`
 * (via `get_user`), and `verify_auth_dict_role`.
 */
export function resolve_admin_level({ email, roles, cookies }: {
  email: string | null | undefined
  /** The user's `users.roles` row value (already-parsed JSON array). */
  roles?: SiteRole[] | null
  cookies?: Pick<Cookies, 'get'>
}): EffectiveAdminLevel {
  if (dev && cookies) {
    const override = cookies.get(DEV_ADMIN_LEVEL_COOKIE)
    if (override === '0')
      return 0
    if (override === '1')
      return 1
    if (override === '2')
      return 2
    if (override === '3')
      return 3
  }
  const allow_list_level = get_admin_level(email)
  if (allow_list_level)
    return allow_list_level
  if (has_super_manager_role(roles))
    return 1
  return 0
}
