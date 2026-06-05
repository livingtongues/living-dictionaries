import type { AdminSchemaResponseBody, AdminSchemaSource } from './+server'
import { get_request } from '$lib/utils/requests'

export async function api_admin_schema({ source = 'shared' }: { source?: AdminSchemaSource } = {}) {
  return await get_request<AdminSchemaResponseBody>(`/api/admin/schema?source=${source}`)
}
