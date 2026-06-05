import type { PartnerWithPhoto } from '$lib/types'
import type { DictionariesIdPartnersRequestBody, DictionariesIdPartnersResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_dictionaries_partners(dict_id: string, body: DictionariesIdPartnersRequestBody) {
  return await post_request<DictionariesIdPartnersRequestBody, DictionariesIdPartnersResponseBody>(
    `/api/dictionaries/${dict_id}/partners`,
    body,
  )
}

export async function api_dictionaries_partners_get(dict_id: string): Promise<PartnerWithPhoto[]> {
  const response = await fetch(`/api/dictionaries/${dict_id}/partners`)
  if (!response.ok) {
    console.error(`Could not load partners: ${response.status}`)
    return []
  }
  const { partners } = await response.json() as { partners: PartnerWithPhoto[] }
  return partners || []
}
