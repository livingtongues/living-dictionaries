import type { Variant } from 'kitbook';
import type Component from './+page.svelte';
import type { Change } from '@living-dictionaries/types';

const history: Change[] = [
  {
    updatedBy: '',
    updatedName: 'Diego Córdova',
    entryId: '001',
    entryName: 'Giraffe',
    dictionaryId: 'Banange',
    dictionaryName: '',
    previousValue: 'created',
    currentValue: '',
    field: '',
    updatedAtMs: 1669598370158
  },
  {
    updatedBy: '',
    updatedName: 'Anna Luisa',
    entryId: '002',
    entryName: 'Elephant',
    dictionaryId: 'Banange',
    dictionaryName: '',
    previousValue: 'created',
    currentValue: '',
    field: '',
    updatedAtMs: 1669593870158
  },
  {
    updatedBy: '',
    updatedName: 'Diego Córdova',
    entryId: '002',
    entryName: 'Elephant',
    dictionaryId: 'Banange',
    dictionaryName: '',
    previousValue: 'edited',
    currentValue: '',
    field: '',
    updatedAtMs: 1669528370158
  },
  {
    updatedBy: '',
    updatedName: 'Anna Luisa',
    entryId: '001',
    entryName: 'Giraffe',
    dictionaryId: 'Banange',
    dictionaryName: '',
    previousValue: 'edited',
    currentValue: '',
    field: '',
    updatedAtMs: 1663898370158
  },
  {
    updatedBy: '',
    updatedName: 'Jacob Bowdoin',
    entryId: '005',
    entryName: 'Monkey',
    dictionaryId: 'Banange',
    dictionaryName: '',
    previousValue: 'created',
    currentValue: '',
    field: '',
    updatedAtMs: 1663812370158
  },
  {
    updatedBy: '',
    updatedName: 'Diego Córdova',
    entryId: '005',
    entryName: 'Monkey',
    dictionaryId: 'Banange',
    dictionaryName: '',
    previousValue: '',
    currentValue: 'mʌŋki',
    field: 'phonetic',
    updatedAtMs: 1663808370558
  },
  {
    updatedBy: '',
    updatedName: 'Anna Luisa',
    entryId: '001',
    entryName: 'Giraffe',
    dictionaryId: 'Banange',
    dictionaryName: '',
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
