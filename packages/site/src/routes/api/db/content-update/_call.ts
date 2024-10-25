import type { ContentUpdateRequestBody } from '@living-dictionaries/types'
import type { ContentUpdateResponseBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function content_update(body: ContentUpdateRequestBody) {
  return await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(`/api/db/content-update`, body)
}
