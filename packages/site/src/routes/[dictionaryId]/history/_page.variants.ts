import type { Variant } from 'kitbook';
import { Timestamp } from 'firebase/firestore';
import type Component from './+page.svelte';

const history = [
  {
    editor: 'Diego Córdova',
    editedLexeme: 'Giraffe',
    entryId: '001',
    editedDictionaryId: 'Banange',
    action: 'created',
    updatedAt: Timestamp.fromDate(new Date(2023, 7, 11, 15, 35, 54))
  },
  {
    editor: 'Anna Luisa',
    editedLexeme: 'Elephant',
    entryId: '002',
    editedDictionaryId: 'Banange',
    action: 'created',
    updatedAt: Timestamp.fromDate(new Date(2023, 8, 24, 15, 36, 54))
  },
  {
    editor: 'Diego Córdova',
    editedLexeme: 'Elephant',
    entryId: '002',
    editedDictionaryId: 'Banange',
    action: 'edited',
    updatedAt: Timestamp.fromDate(new Date(2023, 9, 12, 15, 35, 59))
  },
  {
    editor: 'Anna Luisa',
    editedLexeme: 'Giraffe',
    entryId: '001',
    editedDictionaryId: 'Banange',
    action: 'edited',
    updatedAt: Timestamp.fromDate(new Date(2023, 9, 12, 15, 39, 2))
  },
  {
    editor: 'Jacob Bowdoin',
    editedLexeme: 'Monkey',
    entryId: '005',
    editedDictionaryId: 'Banange',
    action: 'created',
    updatedAt: Timestamp.fromDate(new Date(2023, 9, 31, 12, 35, 9))
  },
  {
    editor: 'Diego Córdova',
    editedLexeme: 'Monkey',
    entryId: '005',
    editedDictionaryId: 'Banange',
    action: 'deleted',
    updatedAt: Timestamp.fromDate(new Date(2023, 10, 1, 15, 36, 54))
  },
  {
    editor: 'Anna Luisa',
    editedLexeme: 'Giraffe',
    entryId: '001',
    editedDictionaryId: 'Banange',
    action: 'deleted',
    updatedAt: Timestamp.fromDate(new Date(2023, 9, 30, 11, 39, 42))
  },
];

export const variants: Variant<Component>[] = [
  {
    name: 'Sorted by latest update',
    props: {
      data: {
        dictionary: {
          name: 'Banange',
          glossLanguages: []
        },
        user: null,
        history: [...history].sort((a, b) => b.updatedAt.toDate().getTime() - a.updatedAt.toDate().getTime())
      }
    }
  },
  {
    name: 'Inverse order',
    props: {
      data: {
        dictionary: {
          name: 'Banange',
          glossLanguages: []
        },
        user: null,
        history: [...history].sort((a, b) => a.updatedAt.toDate().getTime() - b.updatedAt.toDate().getTime())
      }
    }
  },
  {
    name: 'Sorted by action',
    props: {
      data: {
        dictionary: {
          name: 'Banange',
          glossLanguages: []
        },
        user: null,
        history: [...history].sort((a, b) => b.action > a.action ? 1 : -1)
      }
    }
  },
  {
    name: 'Sorted by editor',
    props: {
      data: {
        dictionary: {
          name: 'Banange',
          glossLanguages: []
        },
        user: null,
        history: [...history].sort((a, b) => a.editor > b.editor ? 1 : -1)
      }
    }
  },
  {
    name: 'Sorted by lexeme',
    props: {
      data: {
        dictionary: {
          name: 'Banange',
          glossLanguages: []
        },
        user: null,
        history: [...history].sort((a, b) => a.editedLexeme > b.editedLexeme ? 1 : -1)
      }
    }
  },
]
