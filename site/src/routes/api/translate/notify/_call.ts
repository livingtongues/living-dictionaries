import type { TranslateNotifyResponse } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_translate_notify() {
  return await post_request<Record<string, never>, TranslateNotifyResponse>('/api/translate/notify', {})
}
