import type { Variant } from 'kitbook';
import type Component from './EntryHistory.svelte';
import type { Change } from '@living-dictionaries/types';

const history:Change[] = [
  {
    updatedBy: '0002',
    updatedName: 'Diego Córdova',
    entryName: 'Giraffe',
    entryId: '002',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: ['n'],
    currentValue: [],
    field: 'parts of speech',
    updatedAtMs: 1673598370158
  },
  {
    updatedBy: '0001',
    updatedName: 'Anna Luisa',
    entryName: 'Giraffe',
    entryId: '002',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: ['adj'],
    currentValue: ['n'],
    field: 'parts of speech',
    updatedAtMs: 1673238370158
  },
  {
    updatedBy: '0002',
    updatedName: 'Diego Córdova',
    entryName: 'Giraffe',
    entryId: '002',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: null,
    currentValue: ['adj'],
    field: 'parts of speech',
    updatedAtMs: 1669598370158
  },
  {
    updatedBy: '0001',
    updatedName: 'Anna Luisa',
    entryName: 'Giraffe',
    entryId: '002',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: 'Snake',
    currentValue: 'Giraffe',
    field: 'Lexeme',
    updatedAtMs: 1619598370128
  },
];

export const variants: Variant<Component>[] = [
  {
    name: 'Lexeme history authorized',
    languages: [],
    props: {
      history,
      canEdit: true,
    },
  },
  {
    name: 'Lexeme history unauthorized',
    languages: [],
    props: {
      history,
    },
  },
];
