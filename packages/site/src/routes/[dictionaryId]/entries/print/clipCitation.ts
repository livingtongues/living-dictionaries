//TODO make test file
const maxLength = 167; //Number based if it looks well on letter format
let citationClipped: string;
let textsSum: number;
export function clipCitation(authors: string, citationText: string): string {
  textsSum = authors.length + citationText.length;
  if (textsSum > maxLength) {
    citationClipped = authors.match(/\w+/gm)[0] + ' et al.,';
  } else {
    citationClipped = authors;
  }
  return citationClipped;
}
