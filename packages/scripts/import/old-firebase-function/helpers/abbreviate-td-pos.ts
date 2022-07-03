// import { partsOfSpeech } from '@living-dictionaries/parts';

export interface IMatchResult {
  matchedPOS?: string;
  unMatchedPOS?: string;
  notes?: string;
}

/**
 * Convert old Talking Dictionary parts of speech (both English and Spanish) to English abbreviations
 */
export const abbreviateTDPartOfSpeech = (input: string): IMatchResult => {
  // save any notes in parentheses
  const parentheticalNote = input.match(/\(.+\)/);

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
      (part.tdAlternates && part.tdAlternates.includes(sanitizedInput))
    );
  });
  const result: IMatchResult = {};
  if (matchingPOS) {
    result.matchedPOS = matchingPOS.enAbbrev;
  } else {
    result.unMatchedPOS = sanitizedInput;
  }
  if (parentheticalNote) {
    result.notes = '' + parentheticalNote;
  }
  return result;
};
