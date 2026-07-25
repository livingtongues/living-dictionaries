import type { AdminImportsGetResponseBody } from './+server'
import { get_request } from '$lib/utils/requests'

export async function api_admin_imports_list() {
  return await get_request<AdminImportsGetResponseBody>('/api/admin/imports')
}
