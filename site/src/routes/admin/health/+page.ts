import type { PageLoad } from './$types'
import { api_admin_analytics } from '$api/admin/analytics/_call'
import { browser } from '$app/environment'

/**
 * Universal load for the diagnostics half of the admin telemetry split. Shares the
 * `/api/admin/analytics` endpoint with `/admin/analytics` (usage) — same computed
 * `LogAnalytics`, different panels. The admin parent data comes from a universal
 * `+layout.ts`, so this page can't use a `+page.server.ts`; it fetches via the
 * admin-gated API (passing the load `fetch` so SSR keeps the direct-handler path).
 *
 * Progressive/top-down loading: TWO streamed fetches. `primary` is the shared
 * light tier (summary + charts) — it paints first; `secondary` is the full
 * diagnostics half, which the page SWAPS in below when it resolves. Both are
 * returned un-awaited so client-side nav transitions to a skeleton immediately.
 */
export const load: PageLoad = async ({ fetch, parent, url }) => {
  const { auth_user } = await parent()
  // Not signed in (or not an admin) → the admin layout renders its signed-out /
  // no-access shell and won't render this page, so skip the admin-gated fetch
  // that would otherwise 401 and crash into the generic site-wide error page.
  if (!auth_user.user || !auth_user.is_admin)
    return { primary: null, secondary: null }

  // The Humans/Bots toggle is a URL param; reading it makes `load` re-run (re-fetch)
  // when the operator flips it.
  const audience = url.searchParams.get('audience') === 'bots' ? 'bots' : 'humans'

  // SSR skips the fetch (this universal load re-runs on hydration; its promise
  // doesn't stream on SSR anyway) — the page renders a skeleton and fills in.
  if (!browser)
    return { primary: null, secondary: null }

  async function fetch_scope(scope: 'light' | 'diagnostics') {
    const { data, error: err } = await api_admin_analytics({ fetch, audience, scope })
    if (err || !data)
      throw new Error(err?.message ?? 'Failed to load analytics')
    return data.analytics
  }
  return { primary: fetch_scope('light'), secondary: fetch_scope('diagnostics') }
}
