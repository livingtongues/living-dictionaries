import type { HomepageExportResponseBody } from './+server'
import { get_request } from '$lib/utils/requests'

export async function api_homepage_export(options?: { fetch?: typeof fetch }) {
  return await get_request<HomepageExportResponseBody>('/api/homepage/export', options)
}
