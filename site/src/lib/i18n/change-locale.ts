import type { LocaleCode, UnpublishedLocaleCode } from '$lib/i18n/locales'
import { Locales, UnpublishedLocales } from '$lib/i18n/locales'

export const locales = Object.entries(Locales) as [LocaleCode, Locales][]

export const unpublished_locales = Object.entries(UnpublishedLocales) as [UnpublishedLocaleCode, UnpublishedLocales][]

export function change_locale(locale: LocaleCode | UnpublishedLocaleCode) {
  set_locale_cookie(locale)
  location.reload()
}

export function set_locale_cookie(locale: LocaleCode | UnpublishedLocaleCode) {
  const HUNDRED_YEARS = 60 * 60 * 24 * 365 * 100 // seconds * minutes * hours * days * years
  document.cookie = `locale=${locale}; max-age=${HUNDRED_YEARS}; path=/; samesite=strict`
}
