import type { AdminTranslatorLanguagesRequestBody, AdminTranslatorLanguagesResponseBody } from './+server'
import { get_request, post_request } from '$lib/utils/requests'

export async function api_admin_user_translator_languages(user_id: string, body: AdminTranslatorLanguagesRequestBody) {
  return await post_request<AdminTranslatorLanguagesRequestBody, AdminTranslatorLanguagesResponseBody>(`/api/admin/users/${user_id}/translator-languages`, body)
}

export async function api_admin_user_translator_languages_get(user_id: string) {
  return await get_request<AdminTranslatorLanguagesResponseBody>(`/api/admin/users/${user_id}/translator-languages`)
}
