import type { TranslateSaveRequestBody, TranslateSaveResponse } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_translate_save(body: TranslateSaveRequestBody) {
  return await post_request<TranslateSaveRequestBody, TranslateSaveResponse>('/api/translate/save', body)
}
