import type { RequestHandler } from './$types'
import { json } from '@sveltejs/kit'

export interface AuthLogoutResponseBody {
  ok: true
}

/**
 * Clear the session cookie. Idempotent — succeeds even if no cookie is set.
 * The client should also clear any in-memory user state after a successful
 * response.
 */
export const POST: RequestHandler = ({ cookies }) => {
  cookies.delete('session', { path: '/' })
  return json({ ok: true } satisfies AuthLogoutResponseBody)
}
