import type { LocaleStats, TranslatorInfo } from '$lib/server/i18n/i18n-db'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { gate_translate } from '$lib/server/i18n/api'
import { get_locale_stats, list_translators } from '$lib/server/i18n/i18n-db'
import { error, json } from '@sveltejs/kit'

export interface TranslateSummaryResponse {
  locales: LocaleStats[]
  translators: TranslatorInfo[]
}

/** Per-locale progress + the translator roster, for the /translate admin panel. ADMIN ONLY. */
export const GET: RequestHandler = async (event) => {
  const { db, admin_level } = await gate_translate(event)
  if (admin_level < 2)
    error(ResponseCodes.FORBIDDEN, 'Admin only')
  return json({
    locales: get_locale_stats({ db }),
    translators: list_translators({ db }),
  } satisfies TranslateSummaryResponse)
}
