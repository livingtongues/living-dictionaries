import type { PageLoad } from './$types'
import { api_admin_analytics } from '$api/admin/analytics/_call'
import { error } from '@sveltejs/kit'

/**
 * Universal load — the admin parent data comes from a universal `+layout.ts`, so
 * this page can't use a `+page.server.ts` (the types require universal-load keys).
 * Instead it fetches the server-computed analytics via the admin-gated API endpoint
 * (passing the load `fetch` so SSR keeps the direct-handler optimization).
 */
export const load: PageLoad = async ({ fetch, parent }) => {
  const { auth_user } = await parent()
  // Not signed in (or not an admin) → the admin layout renders its signed-out /
  // no-access shell and won't render this page, so skip the admin-gated fetch
  // that would otherwise 401 and crash into the generic site-wide error page.
  if (!auth_user.user || !auth_user.is_admin)
    return { analytics: null }

  const { data, error: err } = await api_admin_analytics({ fetch })
  if (err || !data)
    error(err?.status ?? 500, err?.message ?? 'Failed to load analytics')
  return { analytics: data.analytics }
}
