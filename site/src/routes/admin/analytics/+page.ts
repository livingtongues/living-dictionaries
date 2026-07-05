import type { PageLoad } from './$types'
import { api_admin_analytics } from '$api/admin/analytics/_call'
import { browser } from '$app/environment'

/**
 * Universal load — the admin parent data comes from a universal `+layout.ts`, so
 * this page can't use a `+page.server.ts` (the types require universal-load keys).
 * Instead it fetches the server-computed analytics via the admin-gated API endpoint
 * (passing the load `fetch` so SSR keeps the direct-handler optimization).
 *
 * The analytics fetch is STREAMED (returned un-awaited) so client-side nav
 * transitions to a skeleton immediately; the payload fills in when it resolves.
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

  // SSR skips the fetch (this universal load re-runs on hydration; its promise
  // doesn't stream on SSR anyway) — the page renders a skeleton and fills in.
  if (!browser)
    return { analytics: null }

  const analytics = (async () => {
    const { data, error: err } = await api_admin_analytics({ fetch, audience })
    if (err || !data)
      throw new Error(err?.message ?? 'Failed to load analytics')
    return data.analytics
  })()
  return { analytics }
}
