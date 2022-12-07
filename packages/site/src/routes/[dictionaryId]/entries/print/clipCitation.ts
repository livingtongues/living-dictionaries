import XRegExp from 'xregexp';

// pL regex supports every Unicode grapheme. See: https://www.regular-expressions.info/unicode.html#prop:~:text=your%20regular%20expression.-,Unicode%20Categories,-In%20addition%20to
const matchFirstAuthor = XRegExp("^((\\pL'?)+ ?(\\w\\.? )*)?");
const maxLength = 167; //Number based if it looks well on letter format
let citationClipped: string;
let textsSum: number;
export function clipCitation(authors: string, citationText: string): string {
  textsSum = authors.length + citationText.length;
  if (textsSum > maxLength) {
    citationClipped = authors.match(matchFirstAuthor)[0] + ' et al.,';
  } else {
    citationClipped = authors;
  }
  return citationClipped;
}
