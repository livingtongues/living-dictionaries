import type { PageLoad } from './$types'
import { api_admin_featured_entries_list } from '$api/admin/featured-entries/_call'
import { error } from '@sveltejs/kit'

export const load: PageLoad = async ({ fetch, parent }) => {
  const { auth_user } = await parent()
  if (!auth_user.user || !auth_user.is_admin)
    return { featured_entries: [] }

  const { data, error: err } = await api_admin_featured_entries_list({ fetch })
  if (err || !data)
    error(err?.status ?? 500, err?.message ?? 'Failed to load featured entries')
  return { featured_entries: data.featured_entries }
}
