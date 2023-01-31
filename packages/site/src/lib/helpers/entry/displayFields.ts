import type { IEntry } from '@living-dictionaries/types';

export function showLocalOrthographies(entry: IEntry) {
  const localOrthographiesRegex = /^(lo[2-5]*)$/gm; // exclusively matches: lo lo2 lo3 lo4 & lo5
  const localOrthographiesKeys = Object.keys(entry).filter((entry) =>
    entry.match(localOrthographiesRegex)
  );
  const localOrthographies = localOrthographiesKeys.map((lo) => entry[lo]);
  return localOrthographies;
}

export function showPartsOfSpeech(partOfSpeech: string | string[]) {
  if (partOfSpeech) {
    if (typeof partOfSpeech !== 'string' && partOfSpeech.length > 0) {
      return partOfSpeech.join(', ') + '.';
    }
    if (typeof partOfSpeech === 'string') return partOfSpeech + '.';
  }
  return '';
}

export function removeItalicTagsWithAPeriod(str: string) {
  if (str) {
    return str.replace(/<\/?i>/g, '') + '.';
  }
  return '';
}

export const unnecessaryLineBreaksRegex = /(?<!\w)\n/gm;
