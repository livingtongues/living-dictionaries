import type { Variant } from 'kitbook';
import { Timestamp } from 'firebase/firestore';
import type Component from './+page.svelte';

export const variants: Variant<Component>[] = [
  {
    name: 'Normal',
    props: {
      data: {
        dictionary: {
          name: 'Banange',
          glossLanguages: []
        },
        user: null,
        history: [
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
        ]
      }
    }
  }
]
