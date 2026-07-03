import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'
import { DEV_ADMIN_LEVEL_COOKIE } from '$lib/server/resolve-admin-level'
import { error, json } from '@sveltejs/kit'

export interface DevAdminLevelRequestBody {
  /** 0 clears the override (back to allow-list + roles); 1, 2 or 3 force that level. `null` also clears. */
  level: 0 | 1 | 2 | 3 | null
}

export interface DevAdminLevelResponseBody {
  result: 'success'
  level: 0 | 1 | 2 | 3 | null
}

/**
 * DEV-ONLY admin-level impersonation toggle. Re-establishes the old "Set Admin
 * Role Level" dev button (which mutated the mock user's `app_metadata.admin`)
 * for the allow-list world: sets a `dev_admin_level` cookie that
 * `resolve_admin_level` honors only when `dev`. Returns 404 in production so
 * the route doesn't even exist there.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  if (!dev)
    error(ResponseCodes.NOT_FOUND, 'Not found')

  const { level } = await request.json() as DevAdminLevelRequestBody

  if (level === 1 || level === 2 || level === 3) {
    cookies.set(DEV_ADMIN_LEVEL_COOKIE, String(level), {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    })
    return json({ result: 'success', level } satisfies DevAdminLevelResponseBody)
  }

  cookies.delete(DEV_ADMIN_LEVEL_COOKIE, { path: '/' })
  return json({ result: 'success', level: null } satisfies DevAdminLevelResponseBody)
}
