import { partsOfSpeech } from '@living-dictionaries/parts';

// export interface IMatchResult {
//     matchedPOS?: string;
//     unMatchedPOS?: string;
// }

export const abbreviateTDPartOfSpeech = (input: string): string => {
  // save any notes in parentheses
  // const parentheticalNote = input.match(/\(.+\)/);

  const sanitizedInput = input
    .replace(/\(.+\)/, '') // remove notes in parentheses
    .trim()
    .toLowerCase()
    .replace(/[.]$/, '') // removes word-final periods
    .replace(/:/g, ''); // removes random colons in old TD data
  const matchingPOS = partsOfSpeech.find((part) => {
    //TODO, possibly more efficient just to return enAbbrev and not whole part object
    return (
      part.enName === sanitizedInput ||
      part.esName === sanitizedInput ||
      part.enAbbrev === sanitizedInput ||
      part.esAbbrev === sanitizedInput ||
      (part.tdAlternates?.includes(sanitizedInput))
    );
  });
  if (matchingPOS) {
    return matchingPOS.enAbbrev;
  } else {
    console.log('unmatched: ', input);
    return null;
  }
};
