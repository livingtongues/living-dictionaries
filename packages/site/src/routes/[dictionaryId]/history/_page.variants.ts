import type { Variant } from 'kitbook';
import type Component from './+page.svelte';
import type { Change } from '@living-dictionaries/types';

const history: Change[] = [
  {
    updatedBy: '0002',
    updatedName: 'Diego Córdova',
    entryId: '001',
    entryName: 'Giraffe',
    dictionaryId: 'banange',
    dictionaryName: 'Banange',
    previousValue: [],
    currentValue: ['n'],
    field: 'parts of speech',
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
    field: 'semantic domains',
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
    field: 'local orthography',
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
  }
];

export const variants: Variant<Component>[] = [
  {
    name: 'Sorted by latest update',
    languages: [],
    props: {
      data: {
        dictionary: {
          name: 'Banange',
          glossLanguages: []
        },
        user: null,
        history: [...history].sort((a, b) => b.updatedAtMs - a.updatedAtMs)
      }
    }
  },
  {
    name: 'Inverse order',
    languages: [],
    props: {
      data: {
        dictionary: {
          name: 'Banange',
          glossLanguages: []
        },
        user: null,
        history: [...history].sort((a, b) => a.updatedAtMs - b.updatedAtMs)
      }
    }
  },
  // {
  //   name: 'Sorted by action',
  //   languages: [],
  //   props: {
  //     data: {
  //       dictionary: {
  //         name: 'Banange',
  //         glossLanguages: []
  //       },
  //       user: null,
  //       history: [...history].sort((a, b) => b.action > a.action ? 1 : -1)
  //     }
  //   }
  // },
  // {
  //   name: 'Sorted by editor',
  //   languages: [],
  //   props: {
  //     data: {
  //       dictionary: {
  //         name: 'Banange',
  //         glossLanguages: []
  //       },
  //       user: null,
  //       history: [...history].sort((a, b) => a.editor > b.editor ? 1 : -1)
  //     }
  //   }
  // },
  // {
  //   name: 'Sorted by lexeme',
  //   languages: [],
  //   props: {
  //     data: {
  //       dictionary: {
  //         name: 'Banange',
  //         glossLanguages: []
  //       },
  //       user: null,
  //       history: [...history].sort((a, b) => a.editedLexeme > b.editedLexeme ? 1 : -1)
  //     }
  //   }
  // },
]
