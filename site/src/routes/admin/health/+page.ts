import type { PageLoad } from './$types'
import { api_admin_analytics } from '$api/admin/analytics/_call'
import { error } from '@sveltejs/kit'

/**
 * Universal load for the diagnostics half of the admin telemetry split. Shares the
 * `/api/admin/analytics` endpoint with `/admin/analytics` (usage) — same computed
 * `LogAnalytics`, different panels. The admin parent data comes from a universal
 * `+layout.ts`, so this page can't use a `+page.server.ts`; it fetches via the
 * admin-gated API (passing the load `fetch` so SSR keeps the direct-handler path).
 */
export const load: PageLoad = async ({ fetch, parent, url }) => {
  const { auth_user } = await parent()
  // Not signed in (or not an admin) → the admin layout renders its signed-out /
  // no-access shell and won't render this page, so skip the admin-gated fetch
  // that would otherwise 401 and crash into the generic site-wide error page.
  if (!auth_user.user || !auth_user.is_admin)
    return { analytics: null }

  // The Humans/Bots toggle is a URL param; reading it makes `load` re-run (re-fetch)
  // when the operator flips it.
  const audience = url.searchParams.get('audience') === 'bots' ? 'bots' : 'humans'
  const { data, error: err } = await api_admin_analytics({ fetch, audience })
  if (err || !data)
    error(err?.status ?? 500, err?.message ?? 'Failed to load analytics')
  return { analytics: data.analytics }
}
