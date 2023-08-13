import { writable } from 'svelte/store';
import type { IColumn } from '@living-dictionaries/types';

import { browser } from '$app/environment';

const defaultColumns: IColumn[] = [
  // field must match those used for i18n
  // {
  //   field: 'lx', // connects to entry.lx in i18n keys
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
    field: 'nc', // nounClass
    width: 150,
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
    field: 'scn', // scientific names
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
const tableCacheKey = 'table_columns_05.4.2023'; // IMPORTANT: rename when adding more columns to invalidate the user's cache
if (browser) {
  cachedColumns = JSON.parse(localStorage.getItem(tableCacheKey));
}

export const preferredColumns = writable(cachedColumns || defaultColumns);

if (browser) {
  preferredColumns.subscribe((selectedColumns) =>
    localStorage.setItem(tableCacheKey, JSON.stringify(selectedColumns))
  );
}
