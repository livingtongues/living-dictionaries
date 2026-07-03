import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { env } from '$env/dynamic/private'
import { notify_user } from '$lib/notifications/notify-admins'
import { gate_translate } from '$lib/server/i18n/api'
import { get_locale_stats, list_translators } from '$lib/server/i18n/i18n-db'
import { build_translator_pending_email } from '$lib/server/i18n/notification-email'
import { error, json } from '@sveltejs/kit'

export interface TranslateNotifyResponse {
  notified: { email: string, name: string | null, total_pending: number }[]
  /** Translators skipped because none of their locales have pending work (or they have no email). */
  skipped: { email: string | null, name: string | null }[]
}

/**
 * The admin "Notify translators" button: every translator whose assigned
 * locales have pending work (missing values or review flags) gets one email
 * with per-locale counts + deep links. ADMIN ONLY; manual — run the AI-fill
 * slash command first so trivially-confirmable flags don't wake anyone.
 */
export const POST: RequestHandler = async (event) => {
  const { db, admin_level } = await gate_translate(event)
  if (admin_level < 2)
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const base_url = env.ORIGIN || 'https://livingdictionaries.app'
  const stats = new Map(get_locale_stats({ db }).map(stat => [stat.locale, stat]))
  const result: TranslateNotifyResponse = { notified: [], skipped: [] }

  for (const translator of list_translators({ db })) {
    const locales = translator.locales.map((locale) => {
      const stat = stats.get(locale)
      return { locale, missing: stat?.missing ?? 0, flagged: stat?.flagged ?? 0 }
    })
    const email = build_translator_pending_email({ name: translator.name, locales, base_url })
    if (!translator.email || !email.total_pending) {
      result.skipped.push({ email: translator.email, name: translator.name })
      continue
    }
    await notify_user({
      email: translator.email,
      name: translator.name,
      subject: email.subject,
      body: `${email.total_pending} translations need your attention`,
      link: `${base_url}/translate?filter=pending`,
      email_subject: email.subject,
      email_html: email.html,
      email_text: email.text,
    })
    result.notified.push({ email: translator.email, name: translator.name, total_pending: email.total_pending })
  }
  return json(result)
}
