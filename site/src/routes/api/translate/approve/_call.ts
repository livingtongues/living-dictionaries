import type { TranslateApproveRequestBody, TranslateApproveResponse } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_translate_approve(body: TranslateApproveRequestBody) {
  return await post_request<TranslateApproveRequestBody, TranslateApproveResponse>('/api/translate/approve', body)
}
