import { orderGlosses } from '../../../../lib/helpers/glosses';
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

  const glosses =
    orderGlosses({
      glosses: entry.gl,
      dictionaryGlossLanguages,
      $t,
      label: true,
    })
      .join(', ')
      .replace(/<\/?i>/g, '') + '.';

  const dialect = entry?.di?.replace(/(?<!\w)\n/gm, '');

  let description = '';
  for (const portion of [localOrthographies, phonetic, partsOfSpeech, glosses, dialect]) {
    if (portion) {
      description += portion.trim() + ' ';
    }
  }

  return description.trim();
}

//TODO these might be helper functions instead, since we can use them in print view and in other places.
export function showLocalOrthographies(entry: IEntry) {
  const localOrthographiesRegex = /^(lo[2-5]*)$/gm; // exclusively matches: lo lo2 lo3 lo4 & lo5
  const localOrthographiesKeys = Object.keys(entry).filter((entry) =>
    entry.match(localOrthographiesRegex)
  );
  const localOrthographies = localOrthographiesKeys.map((lo) => entry[lo]);
  return localOrthographies;
}

export function showPartsOfSpeech(pos: string | string[]) {
  if (pos) {
    if (typeof pos !== 'string' && pos.length > 1) {
      return pos.join(', ') + '.';
    }
    return pos + '.';
  }
  return '';
}
