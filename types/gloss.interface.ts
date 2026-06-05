/* eslint-disable ts/consistent-indexed-object-style */
export interface MultiString {
  [language_bcp__or_writing_system_id: string]: string
}

// in entry.lexeme, sentence.text, entry.notes contexts, this would be different writing system ids:
// {
//   'pinyin-with-tone-number': 'ni3hao3', // used to be just plain lexeme field (lx)
//   'pinyin-with-tone-mark': 'nǐhǎo', // used to be local_orthogaphy_1 (lo1)
//   'traditional': '你好',
// }

// Elsewhere in the app, we will map writing system ids to user friendly names (maybe i18n) and other needs things like fonts/keyboards

// in entry.gloss, sentence.translation contexts this would be different language writing system bcp codes:
// {
//   "en": "hello",
//   "es": "hola",
//   "zh-TW": "你好",
//   "zh-CN": "你好",
// }
