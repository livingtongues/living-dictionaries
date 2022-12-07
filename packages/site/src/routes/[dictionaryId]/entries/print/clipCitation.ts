import XRegExp from 'xregexp';

// pL regex supports every Unicode grapheme. See: https://www.regular-expressions.info/unicode.html#prop:~:text=your%20regular%20expression.-,Unicode%20Categories,-In%20addition%20to
// use of xregexp is because native regex doesn't support pL and other modern syntax. See: https://stackoverflow.com/questions/50178498/no-pl-for-javascript-regex-use-unicode-in-js-regex & https://www.npmjs.com/package/xregexp
const matchFirstAuthor = XRegExp("^((\\pL'?)+ ?(\\w\\.? )*)?");
const maxLength = 167; // number based on whether it looks good in letter format
let citationClipped: string;
let textsSum: number;
export function clipCitation(authors: string, citationText: string): string {
  textsSum = authors.length + citationText.length;
  if (textsSum > maxLength) {
    citationClipped = authors.match(matchFirstAuthor)[0].trim() + ' et al.,';
  } else {
    citationClipped = authors;
  }
  return citationClipped;
}
