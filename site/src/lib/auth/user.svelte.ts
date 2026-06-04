import type { AuthUserData } from './types'
import { api_auth_logout } from '$api/auth/logout/_call.js'
import { api_auth_me } from '$api/auth/me/_call.js'

export type { AuthUserData }

/**
 * Client-side reactive auth state. The trusted source of truth is the
 * httpOnly `session` cookie + the SSR'd `ssr_user` resolved in
 * `+layout.server.ts`. This class is just the reactive Svelte 5 mirror — no
 * persistence of its own, no token storage. Cookies travel automatically on
 * every same-origin fetch.
 */
export class AuthUser {
  user = $state<AuthUserData | null>(null)

  /**
   * Refresh user details from `/api/auth/me`. Useful when re-validating an
   * existing session. A 401/404 wipes local state (the server cookie is the
   * authority); transient 5xx errors do not.
   */
  async verify() {
    const { data, error } = await api_auth_me()
    if (error) {
      if (error.status === 401 || error.status === 404)
        this.user = null
      else
        console.warn(`[AuthUser.verify] transient error status=${error.status} — keeping session:`, error.message)
      return
    }
    this.user = data
  }

  /**
   * Adopt the user returned by a successful login response. The server
   * already set the `session` cookie before responding — nothing else to
   * persist client-side.
   */
  set_session({ user }: { user: AuthUserData }) {
    this.user = user
  }

  /** Clear server cookie + local state. */
  async logout() {
    this.user = null
    await api_auth_logout()
  }
}

let browser_singleton: AuthUser | null = null

/**
 * Return the reactive AuthUser instance.
 *
 * On the client: a process-wide singleton (auth state is shared across all
 * components in a single tab).
 *
 * On the server (SSR): a fresh instance per render. SvelteKit's module cache
 * is shared across concurrent requests, so a module-level singleton would
 * leak one user's state into another's render. Each server-side load gets
 * its own AuthUser, populated from `data.ssr_user` in `+layout.ts`.
 */
export function get_auth_user(): AuthUser {
  if (typeof window === 'undefined')
    return new AuthUser()
  if (!browser_singleton)
    browser_singleton = new AuthUser()
  return browser_singleton
}
