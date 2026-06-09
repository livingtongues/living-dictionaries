import type { AuthUserData } from './types'
import type { PreviewState } from './view-as'
import { api_auth_logout } from '$api/auth/logout/_call.js'
import { api_auth_me } from '$api/auth/me/_call.js'
import { invalidateAll } from '$app/navigation'
import { clamp_preview_level, persona_label } from './view-as'

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
   * Admin-only "View as…" preview (client-only, in-memory). `null` = the real
   * you. When set, the role getters below return the previewed values so the
   * whole UI downgrades to exactly what that persona sees, while the real values
   * stay readable via `real_*` and a hard reload drops back to reality. Server
   * access is untouched (endpoints gate off the JWT), so you can't lock yourself
   * out. See `$lib/auth/view-as.ts`.
   */
  preview = $state<PreviewState | null>(null)

  /** The real allow-list admin flag, ignoring any active preview — gates the "View as" picker itself. */
  get real_is_admin(): boolean {
    return !!this.user?.is_admin
  }

  /** The real numeric admin tier, ignoring any active preview. Caps how far down a preview can step. */
  get real_admin_level(): number {
    return this.user?.is_admin ? (this.user.admin_level ?? 1) : 0
  }

  get previewing(): boolean {
    return this.preview !== null
  }

  /** Human label for the active preview persona (banner + menu), or `null` when not previewing. */
  get preview_label(): string | null {
    return this.preview ? persona_label(this.preview) : null
  }

  /** Site-admin gate (computed server-side from the `$lib/admins` allow-list), preview-aware. */
  get is_admin(): boolean {
    if (this.preview)
      return this.preview.admin_level >= 1
    return this.real_is_admin
  }

  /** Numeric admin tier: 0 = not an admin, else `admin_level` (1 | 2). Preview-aware; for `>= 1` checks. */
  get admin_level(): number {
    if (this.preview)
      return this.preview.admin_level
    return this.real_admin_level
  }

  /**
   * Enter / change the "View as…" preview. Guarded to real admins (no console
   * privilege escalation). The requested level is clamped so it can only step
   * down; landing back on the real level exits the preview.
   */
  set_preview({ admin_level }: PreviewState) {
    if (!this.real_is_admin)
      return
    const level = clamp_preview_level({ requested: admin_level, real_admin_level: this.real_admin_level })
    if (level === this.real_admin_level) {
      this.preview = null
      return
    }
    this.preview = { admin_level: level }
  }

  exit_preview() {
    this.preview = null
  }

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

  /** Clear the server session cookie + local state, then re-run loads so SSR data clears. */
  async logout() {
    await api_auth_logout()
    this.user = null
    this.preview = null
    await invalidateAll()
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
