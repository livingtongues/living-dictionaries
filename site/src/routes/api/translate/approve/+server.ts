import type { I18nTranslationRow } from '$lib/server/i18n/i18n-db'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { gate_translate_locale, throw_i18n_error } from '$lib/server/i18n/api'
import { approve_translation } from '$lib/server/i18n/i18n-db'
import { error, json } from '@sveltejs/kit'

export interface TranslateApproveRequestBody {
  key_id: string
  locale: string
}

export interface TranslateApproveResponse {
  row: I18nTranslationRow
}

/** A translator confirms a flagged (AI-suggested / English-changed) value is good as-is. */
export const POST: RequestHandler = async (event) => {
  const body = await event.request.json() as TranslateApproveRequestBody
  const { db, user_id, name, email } = await gate_translate_locale(event, body.locale)
  if (!body.key_id)
    error(ResponseCodes.BAD_REQUEST, 'key_id required')
  try {
    const row = approve_translation({
      db,
      key_id: body.key_id,
      locale: body.locale,
      updated_by_user_id: user_id,
      updated_by_name: name || email,
    })
    return json({ row } satisfies TranslateApproveResponse)
  } catch (err) {
    throw_i18n_error(err)
  }
}
