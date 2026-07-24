import { Locales, UnpublishedLocales } from '$lib/i18n/locales'
import type { LocaleCode, UnpublishedLocaleCode } from '$lib/i18n/locales'
import { LOCALE_CHANGED } from '$lib/debug/log-events'
import { track } from '$lib/debug/remote-log'

export const locales = Object.entries(Locales) as [LocaleCode, Locales][]

export const unpublished_locales = Object.entries(UnpublishedLocales) as [UnpublishedLocaleCode, UnpublishedLocales][]

export function change_locale(locale: LocaleCode | UnpublishedLocaleCode) {
  // Switcher discovery telemetry: from→to pairs show whether users find the
  // switcher and whether a translation drives them back to English. `track`
  // buffers synchronously to localStorage, so the reload doesn't lose it.
  try {
    track({ event: LOCALE_CHANGED, props: { from: read_locale_cookie(), to: locale } })
  } catch { /* never block a locale switch on telemetry */ }
  set_locale_cookie(locale)
  location.reload()
}

/** The current `locale` cookie value, or null when unset (Accept-Language default). */
function read_locale_cookie(): string | null {
  const match = /(?:^|;\s*)locale=([^;]+)/.exec(document.cookie)
  return match ? match[1] : null
}

export function set_locale_cookie(locale: LocaleCode | UnpublishedLocaleCode) {
  const HUNDRED_YEARS = 60 * 60 * 24 * 365 * 100 // seconds * minutes * hours * days * years
  document.cookie = `locale=${locale}; max-age=${HUNDRED_YEARS}; path=/; samesite=strict`
}
