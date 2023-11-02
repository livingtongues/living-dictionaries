import type { Variant } from 'kitbook';
import type Component from './EntryHistory.svelte';
import { Timestamp } from 'firebase/firestore';

const history = [
  {
    editor: 'Anna Luisa',
    editedLexeme: 'Giraffe',
    entryId: 'EntryHistory',
    editedDictionaryId: 'Banange',
    action: 'edited',
    updatedAt: Timestamp.fromDate(new Date(2023, 9, 12, 18, 39, 2))
  },
  {
    editor: 'Diego Córdova',
    editedLexeme: 'Elephant',
    entryId: 'EntryHistory',
    editedDictionaryId: 'Banange',
    action: 'edited',
    updatedAt: Timestamp.fromDate(new Date(2023, 9, 12, 15, 35, 59))
  },
];

export const variants: Variant<Component>[] = [
  {
    name: 'Lexeme history authorized',
    props: {
      history,
      canEdit: true,
    },
  },
  {
    name: 'Lexeme history unauthorized',
    props: {
      history,
    },
  },
]
