const maxLength = 167; //Number based if it looks well on letter format
let citationClipped: string;
let textsSum: number;
export function clipCitation(citation: string, citationText: string): string {
  textsSum = citation.length + citationText.length;
  if (textsSum > maxLength) {
    // When they follow the pattern: [Last name] [First letter from first name].,
    citationClipped = citation.split('.,')[0];
    // Otherwise, we only consider the first word
    if (citation === citationClipped) {
      citationClipped = citation.match(/\w+/gm)[0];
    }
  }
  return citationClipped;
}
