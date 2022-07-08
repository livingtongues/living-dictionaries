import { writable, derived } from 'svelte/store';
import type { IColumn } from '@living-dictionaries/types';
import { vernacularName } from '$lib/helpers/vernacularName';
import { dictionary } from './dictionary';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { browser } from '$app/env';

const defaultColumns: IColumn[] = [
  // Keys match those use for i18n
  // {
  //   field: "checked",
  //   width: 25,
  //   hidden: true,
  //   sticky: true,
  // },
  {
    field: 'lx', // lexeme
    width: 170,
    sticky: true,
  },
  {
    field: 'soundFile',
    width: 31, // 50? // AudioCell
  },
  {
    field: 'photoFile',
    width: 31, // 50? // ImageCell
  },
  // TODO: add videos to columns
  // {
  //   field: 'videoFile',
  //   width: 31, // 50? // VideoCell
  // },
  {
    field: 'gloss',
    width: 250,
  },
  {
    field: 'alternateOrthographies',
    width: 170,
  },
  {
    field: 'ei', // elicitation ID
    width: 90,
  },
  {
    field: 'sdn', // semanticDomain
    width: 200,
  },
  {
    field: 'ps', // partOfSpeech
    width: 137, // SelectPOS
  },
  {
    field: 'ph', // phonetic
    width: 170,
  },
  {
    field: 'speaker',
    width: 150, // SelectSpeakerCell
  },
  {
    field: 'di', // dialect
    width: 130,
  },
  {
    field: 'in', // interlinearization
    width: 150,
  },
  {
    field: 'mr', // morphology
    width: 150,
  },
  {
    field: 'pl', // plural form
    width: 150,
  },
  {
    field: 'nt', // notes
    width: 300,
  },
  {
    field: 'example_sentence',
    width: 300,
  },
  {
    field: 'sr', // source
    width: 200,
  },
];

let cachedColumns: IColumn[] = [];
const tableCacheKey = 'table_columns_4.7.2021';
if (browser) {
  cachedColumns = JSON.parse(localStorage.getItem(tableCacheKey));
}

// IMPORTANT: rename tableCacheKey when adding more columns to invalidate the user's cache which will not include the new column
export const preferredColumns = writable(cachedColumns || defaultColumns);

if (browser) {
  preferredColumns.subscribe((selectedColumns) =>
    localStorage.setItem(tableCacheKey, JSON.stringify(selectedColumns))
  );
}
// Possible idea: if no set of preferredcolumns is in localstorage then query firestore if dictionary defaults exist

export const columns = derived(
  [preferredColumns, dictionary],
  ([$preferredColumns, $dictionary]) => {
    const cols = $preferredColumns.filter((column) => !column.hidden);

    const glossIndex = cols.findIndex((col) => col.field === 'gloss');
    if (glossIndex >= 0) {
      const $_ = get(_);
      const glossColumns: IColumn[] = [];
      $dictionary.glossLanguages.forEach((bcp) => {
        glossColumns.push({
          field: bcp,
          width: cols[glossIndex].width,
          sticky: cols[glossIndex].sticky || false,
          display: $_('gl.' + bcp),
          explanation: vernacularName(bcp),
          gloss: true,
        });
      });
      cols.splice(glossIndex, 1, ...glossColumns);
    }

    const exampleSentenceIndex = cols.findIndex((col) => col.field === 'example_sentence');
    if (exampleSentenceIndex >= 0) {
      const $_ = get(_);
      const exampleSentenceColumns: IColumn[] = [
        {
          field: 'xv',
          width: cols[exampleSentenceIndex].width,
          sticky: cols[exampleSentenceIndex].sticky || false,
          display: $_('entry.example_sentence', { default: 'Example Sentence' }),
          exampleSentence: true,
        },
      ];
      $dictionary.glossLanguages.forEach((bcp) => {
        exampleSentenceColumns.push({
          field: bcp,
          width: cols[exampleSentenceIndex].width,
          sticky: cols[exampleSentenceIndex].sticky || false,
          display: `${$_(`gl.${bcp}`)} ${$_('entry.example_sentence', {
            default: 'Example Sentence',
          })}`,
          exampleSentence: true,
        });
      });
      cols.splice(exampleSentenceIndex, 1, ...exampleSentenceColumns);
    }

    const orthographyIndex = cols.findIndex((col) => col.field === 'alternateOrthographies');
    if (orthographyIndex >= 0) {
      const alternateOrthographyColumns: IColumn[] = [];
      if ($dictionary.alternateOrthographies) {
        for (const [index, orthography] of $dictionary.alternateOrthographies.entries()) {
          alternateOrthographyColumns.push({
            field: index === 0 ? 'lo' : 'lo' + (index + 1),
            width: 170,
            display: orthography,
            orthography: true,
          });
        }
      }
      cols.splice(orthographyIndex, 1, ...alternateOrthographyColumns);
    }

    return cols;
  }
);
