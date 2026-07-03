import type { TranslateDataResponse } from './+server'
import { get_request } from '$lib/utils/requests'

export async function api_translate_data({ locale }: { locale: string }) {
  return await get_request<TranslateDataResponse>(`/api/translate/data?locale=${encodeURIComponent(locale)}`)
}
