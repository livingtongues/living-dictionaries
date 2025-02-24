import type { GCSServingUrlRequestBody, GCSServingUrlResponseBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function api_gcs_serving_url(body: GCSServingUrlRequestBody) {
  return await post_request<GCSServingUrlRequestBody, GCSServingUrlResponseBody>(`/api/gcs_serving_url`, body)
}
