import { orderGlosses } from '../../../../lib/helpers/glosses';
import {
  showLocalOrthographies,
  showPartsOfSpeech,
  removeItalicTagsWithAPeriod,
  unnecessaryLineBreaksRegex,
} from '../../../../lib/helpers/entry/displayFields';
import type { IEntry } from '@living-dictionaries/types';

// function previousMethod(entry: IEntry, dictionaryGlossLanguages: string[], $t: (key: string) => string) {
//   return `${entry.lo ? entry.lo : ''} ${entry.lo2 ? entry.lo2 : ''} ${
//     entry.lo3 ? entry.lo3 : ''
//   }
//   ${entry.ph ? '[' + entry.ph + ']' : ''} ${
//     entry.ps
//       ? typeof entry.ps !== 'string' && entry.ps.length > 1
//         ? entry.ps.join(', ') + '.'
//         : entry.ps + '.'
//       : ''
//   }
//   ${
//     orderGlosses({
//       glosses: entry.gl,
//       dictionaryGlossLanguages,
//       $t,
//       label: true,
//     })
//       .join(', ')
//       .replace(/<\/?i>/g, '') + '.'
//   }
//   ${entry.di ? entry.di : ''}`.replace(/(?<!\w)\n/gm, '')
// }

export function seoDescription(
  entry: IEntry,
  dictionaryGlossLanguages: string[],
  $t: (key: string) => string
) {
  const localOrthographies = showLocalOrthographies(entry).join(' ');

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

  let description = '';
  for (const portion of [localOrthographies, phonetic, partsOfSpeech, glosses, dialect]) {
    if (portion) {
      description += portion.trim() + ' ';
    }
  }

  return description.replace(unnecessaryLineBreaksRegex, '').trim();
}
