import type { UploadRequestBody, UploadResponseBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function api_upload(body: UploadRequestBody) {
  return await post_request<UploadRequestBody, UploadResponseBody>(`/api/upload`, body)
}
