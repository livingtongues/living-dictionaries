import type { Variant, Viewport } from 'kitbook';
import type Component from './+page.svelte';
import type { Change } from '@living-dictionaries/types';

export const viewports: Viewport[] = [{
  width: 700,
  height: 550,
},
{
  width: 300,
  height: 500
}];

const history: Change[] = [
  {
    updatedBy: '0002',
    updatedName: 'Diego Córdova',
    entryId: '001',
    entryName: 'Giraffe',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: ['n'],
    currentValue: ['n', 'adj'],
    field: 'parts_of_speech',
    updatedAtMs: 1669598370158
  },
  {
    updatedBy: '0001',
    updatedName: 'Anna Luisa',
    entryId: '002',
    entryName: 'Elephant',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: null,
    currentValue: ['1.5'],
    field: 'semantic_domains',
    updatedAtMs: 1669593870158
  },
  {
    updatedBy: '0002',
    updatedName: 'Diego Córdova',
    entryId: '002',
    entryName: 'Elephant',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: '',
    currentValue: 'Elephant',
    field: 'lexeme',
    updatedAtMs: 1669528370158
  },
  {
    updatedBy: '0001',
    updatedName: 'Anna Luisa',
    entryId: '001',
    entryName: 'Giraffe',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: '',
    currentValue: 'Жирафа',
    field: 'local_orthography',
    updatedAtMs: 1663898370158
  },
  {
    updatedBy: '0003',
    updatedName: 'Jacob Bowdoin',
    entryId: '005',
    entryName: 'Monkey',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: 'mʌŋki',
    currentValue: '',
    field: 'phonetic',
    updatedAtMs: 1663812370158
  },
  {
    updatedBy: '0002',
    updatedName: 'Diego Córdova',
    entryId: '005',
    entryName: 'Monkey',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: '',
    currentValue: 'mʌŋki',
    field: 'phonetic',
    updatedAtMs: 1663808370558
  },
  {
    updatedBy: '0001',
    updatedName: 'Anna Luisa',
    entryId: '001',
    entryName: 'Giraffe',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: 'Snake',
    currentValue: 'Giraffe',
    field: 'lexeme',
    updatedAtMs: 1660099370158
  },
  {
    updatedBy: '0002',
    updatedName: 'Diego Córdova',
    entryId: '011',
    entryName: 'Snake',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: '',
    currentValue: 'víbora',
    field: 'gloss',
    updatedAtMs: 1690039310158
  }
];

const mockLayoutData = {
  user: null,
  locale: null,
  t: null,
}

export const variants: Variant<Component>[] = [
  {
    name: 'Sorted by latest update',
    languages: [],
    props: {
      data: {
        dictionary: {
          id: 'banange',
          name: 'Banange',
          glossLanguages: []
        },
        history: [...history].sort((a, b) => b.updatedAtMs - a.updatedAtMs),
        ...mockLayoutData,
      }
    }
  }
]
