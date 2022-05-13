// Live for all users
export enum ReadyLocales {
  en = 'English',
  es = 'Español',
  fr = 'Français',
  sw = 'Kiswahili',
  ru = 'русский',
  he = 'עברית',
  pt = 'Portuguese',
  id = 'Bahasa Indonesia',
  ms = 'Malay',
  bn = 'বাংলা', // Bengali,
  as = 'Assamese / অসমীয়া',
  hi = 'हिन्दी',
  zh = '官话',
}

// Admin only
export enum UnpublishedLocales {
  ha = 'Harshen Hausa / هَرْشَن هَوْسَ',
  ar = 'العَرَبِيَّة‎',
  am = 'አማርኛ',
  or = 'ଓଡ଼ିଆ',
  // it = 'Italiano', // change to how they spell it
  // as = 'অসমীয়া',
  // yo = 'Yoruba'
  // zu = 'Zulu'
  // sn = 'Shona'
  // tl = 'Tagalog' // (or could be Filipino 'fil')
}
// add more codes from https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry

export type Languages = keyof typeof ReadyLocales;

// export interface ITranslatedField {
//   language: Languages;
// }
