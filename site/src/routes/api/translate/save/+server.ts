import type { I18nTranslationRow } from '$lib/server/i18n/i18n-db'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { gate_translate_locale, throw_i18n_error } from '$lib/server/i18n/api'
import { upsert_translation } from '$lib/server/i18n/i18n-db'
import { error, json } from '@sveltejs/kit'

export interface TranslateSaveRequestBody {
  key_id: string
  locale: string
  value: string
}

export interface TranslateSaveResponse {
  /** The stored row; null when an empty value deleted the translation. */
  row: I18nTranslationRow | null
}

/**
 * Write one translation as the calling translator (source='human', clears any
 * review flag). An empty value deletes the row (missing = untranslated).
 */
export const POST: RequestHandler = async (event) => {
  const body = await event.request.json() as TranslateSaveRequestBody
  const { db, user_id, name, email } = await gate_translate_locale(event, body.locale)
  if (!body.key_id || typeof body.value !== 'string')
    error(ResponseCodes.BAD_REQUEST, 'key_id and value required')
  try {
    const row = upsert_translation({
      db,
      key_id: body.key_id,
      locale: body.locale,
      value: body.value,
      source: 'human',
      updated_by_user_id: user_id,
      updated_by_name: name || email,
    })
    return json({ row } satisfies TranslateSaveResponse)
  } catch (err) {
    throw_i18n_error(err)
  }
}
