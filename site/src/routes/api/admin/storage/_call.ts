import type { AdminStorageResponseBody } from './+server'
import { get_request } from '$lib/utils/requests'

export async function api_admin_storage(options?: { fetch?: typeof fetch }) {
  return await get_request<AdminStorageResponseBody>('/api/admin/storage', options)
}
