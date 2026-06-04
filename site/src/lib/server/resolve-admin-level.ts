import type { AdminLevel } from '$lib/admins'
import type { Cookies } from '@sveltejs/kit'
import { dev } from '$app/environment'
import { get_admin_level } from '$lib/admins'

export const DEV_ADMIN_LEVEL_COOKIE = 'dev_admin_level'

/**
 * Resolve a user's admin level. Normally derived from the `$lib/admins.ts`
 * allow-list by email. In DEV ONLY, a `dev_admin_level` cookie (`0|1|2`)
 * overrides it so a developer can impersonate any admin level without editing
 * the allow-list — re-establishing the old "Set Admin Role Level" dev toggle
 * that used to mutate the mock user's `app_metadata.admin`.
 *
 * Strictly dev-gated (`dev` is compiled to `false` in prod builds), so a
 * forged cookie has no effect in production. Applied at every server-side
 * admin resolution point: root `+layout.server.ts` (ssr_user), `/api/auth/me`
 * (via `get_user`), and `verify_auth_dict_role`.
 */
export function resolve_admin_level({ email, cookies }: {
  email: string | null | undefined
  cookies?: Pick<Cookies, 'get'>
}): AdminLevel | null {
  if (dev && cookies) {
    const override = cookies.get(DEV_ADMIN_LEVEL_COOKIE)
    if (override === '0')
      return null
    if (override === '1')
      return 1
    if (override === '2')
      return 2
  }
  return get_admin_level(email)
}
