import type { TranslateSummaryResponse } from './+server'
import { get_request } from '$lib/utils/requests'

export async function api_translate_summary() {
  return await get_request<TranslateSummaryResponse>('/api/translate/summary')
}
