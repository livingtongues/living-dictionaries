import type { CreateDictionaryRequestBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function api_create_dictionary(body: CreateDictionaryRequestBody) {
  return await post_request<CreateDictionaryRequestBody, null>(`/api/db/create-dictionary`, body)
}
