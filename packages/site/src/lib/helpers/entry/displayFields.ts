import type { IEntry } from '@living-dictionaries/types';

export function getLocalOrthographies(entry: IEntry): string[] {
  const possibleLocalOrthographyFields = ['lo', 'lo2', 'lo3', 'lo4', 'lo5'];
  const localOrthographiesFieldsUsed = Object.keys(entry).filter((field) => {
    if (possibleLocalOrthographyFields.includes(field)) return !!entry[field];
  });
  return localOrthographiesFieldsUsed.map((field) => entry[field]);
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

export function commaSeparateItemsIntoString(sections: string[]): string {
  return sections
    .filter((section) => section)
    .map((section) => section.trim())
    .join(', ');
}

export function removeItalicTagsWithAPeriod(str: string) {
  if (str) {
    return str.replace(/<\/?i>/g, '') + '.';
  }
  return '';
}
