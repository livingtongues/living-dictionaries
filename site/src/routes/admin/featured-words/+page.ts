import type { PageLoad } from './$types'
import { api_admin_featured_entries_list } from '$api/admin/featured-entries/_call'
import { browser } from '$app/environment'

export const load: PageLoad = async ({ fetch, parent }) => {
  const { auth_user } = await parent()
  if (!auth_user.user || !auth_user.is_admin)
    return { featured_entries: [] }

  // Streamed on the client so nav transitions to a skeleton immediately; the
  // list fills in when the fetch resolves. SSR skips the fetch (this universal
  // load re-runs on hydration; its promise doesn't stream on SSR anyway).
  if (!browser)
    return { featured_entries: [] }

  const featured_entries = (async () => {
    const { data, error: err } = await api_admin_featured_entries_list({ fetch })
    if (err || !data)
      throw new Error(err?.message ?? 'Failed to load featured entries')
    return data.featured_entries
  })()
  return { featured_entries }
}
