import type { AuthUserData } from '$lib/auth/types'
import type { LayoutLoad } from './$types'
import { browser } from '$app/environment'
import { get_auth_user } from '$lib/auth/user.svelte.js'
import { get_my_dictionary_roles } from '$lib/me/dictionary-roles.svelte.js'

export const load: LayoutLoad = ({ data }) => {
  const auth_user = get_auth_user()
  const dict_roles = get_my_dictionary_roles()
  // Source of truth = the server's verified session cookie, surfaced as
  // `ssr_user` from `+layout.server.ts`. Re-runs on every navigation so
  // logout-from-another-tab and token expiry stay in sync.
  if (data.ssr_user) {
    // The SSR shape is intentionally a minimal subset; widen by populating
    // unknown fields with safe defaults until `/api/auth/me` (called by
    // pages that need the full shape) fills them in.
    const merged: AuthUserData = {
      id: data.ssr_user.id,
      email: data.ssr_user.email,
      name: data.ssr_user.name,
      avatar_url: auth_user.user?.avatar_url ?? null,
      created_at: auth_user.user?.created_at ?? '',
      is_admin: data.ssr_user.is_admin,
      // Prefer the SSR-resolved level (always correct from the cookie) over
      // a stale client mirror — keeps level-gated UI correct on first paint.
      admin_level: data.ssr_user.admin_level ?? auth_user.user?.admin_level ?? null,
      preferred_locale: data.ssr_user.preferred_locale ?? auth_user.user?.preferred_locale ?? null,
      unsubscribed_from_emails: auth_user.user?.unsubscribed_from_emails ?? false,
    }
    auth_user.set_session({ user: merged })
    // Keep the dict-roles cache keyed under the right user; refresh in the
    // background if stale > 1h. Server-side renders skip the refresh.
    dict_roles.set_user(merged.id)
    if (browser)
      void dict_roles.refresh_if_stale()
  } else {
    auth_user.user = null
    dict_roles.forget()
  }
  return { auth_user, dict_roles, ssr_user: data.ssr_user }
}
