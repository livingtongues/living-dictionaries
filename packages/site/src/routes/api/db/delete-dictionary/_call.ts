import type { DeleteDictionaryRequestBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function api_delete_dictionary(body: DeleteDictionaryRequestBody) {
  return await post_request<DeleteDictionaryRequestBody, null>(`/api/db/delete-dictionary`, body)
}
