import { Locales, type LocaleCode, UnpublishedLocales, type UnpublishedLocaleCode } from '$lib/i18n/locales';

export const locales = Object.entries(Locales) as [LocaleCode, Locales][];

export const unpublishedLocales = Object.entries(UnpublishedLocales) as [UnpublishedLocaleCode, UnpublishedLocales][];

export function changeLocale(locale: LocaleCode | UnpublishedLocaleCode) {
  setLocaleCookie(locale);
  location.reload();
}

export function setLocaleCookie(locale: LocaleCode | UnpublishedLocaleCode) {
  const HUNDRED_YEARS = 60 * 60 * 24 * 365 * 100; // seconds * minutes * hours * days * years
  document.cookie = `locale=${locale}; max-age=${HUNDRED_YEARS}; path=/; samesite=strict`;
}
