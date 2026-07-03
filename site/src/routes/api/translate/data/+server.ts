import type { TranslateRow } from '$lib/server/i18n/i18n-db'
import type { RequestHandler } from './$types'
import { gate_translate_locale } from '$lib/server/i18n/api'
import { list_locale_rows } from '$lib/server/i18n/i18n-db'
import { json } from '@sveltejs/kit'

export interface TranslateDataResponse {
  locale: string
  rows: TranslateRow[]
}

/** Every active key + this locale's translations, for the /translate editor. */
export const GET: RequestHandler = async (event) => {
  const locale = event.url.searchParams.get('locale')
  const { db } = await gate_translate_locale(event, locale)
  return json({ locale, rows: list_locale_rows({ db, locale }) } satisfies TranslateDataResponse)
}
