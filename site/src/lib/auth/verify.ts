import type { Cookies } from '@sveltejs/kit'
import { ResponseCodes } from '$lib/constants'
import { error } from '@sveltejs/kit'
import { verify_jwt } from './jwt'

/**
 * Verify a request's session. Cookie-first, Authorization-header fallback.
 *
 * Cookie path: `session=<JWT>` (httpOnly, set on email-verify / OAuth callback).
 * Header path: `Authorization: Bearer <JWT>` — retained for non-browser callers
 * (CLI scripts, future API integrations) that don't carry cookies.
 *
 * Accepts a SvelteKit RequestEvent-like shape so it can be called from both
 * `+server.ts` handlers (`(event) => verify_auth(event)`) and tests/scripts
 * that synthesize `{ request, cookies? }`.
 */
export async function verify_auth(event: {
  request: Request
  cookies?: Pick<Cookies, 'get'>
}): Promise<{ user_id: string, email: string | undefined, name: string | undefined }> {
  const cookie_token = event.cookies?.get('session') ?? null
  const auth_header = event.request.headers.get('Authorization')
  let header_token: string | null = null
  if (auth_header) {
    if (!auth_header.startsWith('Bearer '))
      error(ResponseCodes.UNAUTHORIZED, 'Invalid Authorization header format')
    const stripped = auth_header.slice('Bearer '.length)
    if (stripped)
      header_token = stripped
  }

  const token = cookie_token || header_token
  if (!token)
    error(ResponseCodes.UNAUTHORIZED, 'Missing session')

  try {
    const payload = await verify_jwt(token)
    return {
      user_id: payload.sub,
      email: payload.email,
      name: payload.name,
    }
  } catch {
    error(ResponseCodes.UNAUTHORIZED, 'Invalid or expired token')
  }
}
