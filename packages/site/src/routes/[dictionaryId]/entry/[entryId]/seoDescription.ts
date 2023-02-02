import { orderGlosses } from '$lib/helpers/glosses';
import {
  getLocalOrthographies,
  showPartsOfSpeech,
  removeItalicTagsWithAPeriod,
  showDescription,
} from '$lib/helpers/entry/displayFields';
import type { IEntry } from '@living-dictionaries/types';

export function seoDescription(
  entry: IEntry,
  dictionaryGlossLanguages: string[],
  $t: (key: string) => string
) {
  const localOrthographies = getLocalOrthographies(entry).join(' ');

  const phonetic = entry.ph && `[${entry.ph}]`;

  const partsOfSpeech = showPartsOfSpeech(entry.ps);

  const glosses = removeItalicTagsWithAPeriod(
    orderGlosses({
      glosses: entry.gl,
      dictionaryGlossLanguages,
      $t,
      label: true,
    }).join(', ')
  );

  const dialect = entry?.di;

  const description = showDescription([
    localOrthographies,
    phonetic,
    partsOfSpeech,
    glosses,
    dialect,
  ]);

  return removeLineBreaks(description);
}

const lineBreaksIncludingOptionalPreceedingWhitespaceRegex = /\s*?\n/g;
export function removeLineBreaks(text: string): string {
  return text.replace(lineBreaksIncludingOptionalPreceedingWhitespaceRegex, ' ').trim();
}
