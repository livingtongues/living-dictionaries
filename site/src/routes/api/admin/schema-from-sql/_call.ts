import type { AdminSchemaFromSqlRequestBody, AdminSchemaFromSqlResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_schema_from_sql(body: AdminSchemaFromSqlRequestBody) {
  return await post_request<AdminSchemaFromSqlRequestBody, AdminSchemaFromSqlResponseBody>(
    '/api/admin/schema-from-sql',
    body,
  )
}
