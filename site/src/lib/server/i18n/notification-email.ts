/**
 * Build the "you have pending translations" email for one translator. Pure
 * (no DB / env) like chat's notification-email so tests can pin the output.
 */
import { get_locale_display_name } from '$lib/i18n/locales'
import { escape_html } from '$lib/server/chat/notification-email'

export interface TranslatorPendingLocale {
  locale: string
  missing: number
  flagged: number
}

export interface TranslatorPendingEmailInput {
  name: string | null
  locales: TranslatorPendingLocale[]
  base_url: string
}

export interface TranslatorPendingEmail {
  subject: string
  html: string
  text: string
  total_pending: number
}

export function build_translator_pending_email({ name, locales, base_url }: TranslatorPendingEmailInput): TranslatorPendingEmail {
  const pending = locales.filter(entry => entry.missing + entry.flagged > 0)
  const total_pending = pending.reduce((sum, entry) => sum + entry.missing + entry.flagged, 0)
  const subject = `Living Dictionaries: ${total_pending} translation${total_pending === 1 ? '' : 's'} need${total_pending === 1 ? 's' : ''} your attention`

  const describe = ({ missing, flagged }: TranslatorPendingLocale) => {
    const parts: string[] = []
    if (missing)
      parts.push(`${missing} untranslated`)
    if (flagged)
      parts.push(`${flagged} to review`)
    return parts.join(' · ')
  }

  const rows = pending.map((entry) => {
    const link = `${base_url}/translate?locale=${entry.locale}&filter=pending`
    return `<li style="margin:0 0 8px"><a href="${link}" style="color:#2563eb;font-weight:600;text-decoration:none">${escape_html(get_locale_display_name(entry.locale))}</a> — ${describe(entry)}</li>`
  }).join('')

  const html = [
    `<p style="margin:0 0 14px">Hi ${escape_html(name || 'there')},</p>`,
    `<p style="margin:0 0 14px">Some Living Dictionaries interface translations are waiting on you:</p>`,
    `<ul style="margin:0 0 18px;padding-left:20px">${rows}</ul>`,
    `<p style="margin:0"><a href="${base_url}/translate?filter=pending" style="display:inline-block;padding:9px 18px;border-radius:6px;background:#2563eb;color:#fff;text-decoration:none;font-weight:600">Open the translation dashboard</a></p>`,
    `<p style="margin:18px 0 0;color:#6b7280;font-size:13px">Items marked "to review" were machine-translated or their English source changed — please confirm or correct them.</p>`,
  ].join('')

  const text = [
    `Hi ${name || 'there'},`,
    '',
    'Some Living Dictionaries interface translations are waiting on you:',
    ...pending.map(entry => `- ${get_locale_display_name(entry.locale)}: ${describe(entry)} → ${base_url}/translate?locale=${entry.locale}&filter=pending`),
    '',
    `Open the translation dashboard: ${base_url}/translate?filter=pending`,
  ].join('\n')

  return { subject, html, text, total_pending }
}

if (import.meta.vitest) {
  describe(build_translator_pending_email, () => {
    test('lists only locales with pending work and totals them', () => {
      const email = build_translator_pending_email({
        name: 'Tina',
        locales: [
          { locale: 'es', missing: 3, flagged: 2 },
          { locale: 'fr', missing: 0, flagged: 0 },
        ],
        base_url: 'https://livingdictionaries.app',
      })
      expect(email.total_pending).toBe(5)
      expect(email.subject).toContain('5 translations need')
      expect(email.html).toContain('/translate?locale=es&filter=pending')
      expect(email.html).not.toContain('Français')
      expect(email.text).toContain('Español: 3 untranslated · 2 to review')
    })
  })
}
