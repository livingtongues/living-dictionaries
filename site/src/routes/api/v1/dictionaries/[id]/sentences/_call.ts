import type { V1SentencePostRequestBody, V1SentencePostResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_v1_create_sentence({ dictionary_id, ...body }: { dictionary_id: string } & V1SentencePostRequestBody) {
  return await post_request<V1SentencePostRequestBody, V1SentencePostResponseBody>(`/api/v1/dictionaries/${dictionary_id}/sentences`, body)
}
