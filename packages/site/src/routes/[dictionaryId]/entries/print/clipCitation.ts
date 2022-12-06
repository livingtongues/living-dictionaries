//TODO make test file
const maxLength = 167; //Number based if it looks well on letter format
let citationClipped: string;
let textsSum: number;
export function clipCitation(authors: string, citationText: string): string {
  textsSum = authors.length + citationText.length;
  if (textsSum > maxLength) {
    // When they follow the pattern: [Last name] [First letter from first name].,
    citationClipped = authors.split('.,')[0];
    // Otherwise, we only consider the first word
    if (authors === citationClipped) {
      citationClipped = authors.match(/\w+/gm)[0] + '.';
    }
  } else {
    citationClipped = authors;
  }
  return citationClipped;
}
