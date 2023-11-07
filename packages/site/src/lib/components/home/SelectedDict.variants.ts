import type { Variant } from 'kitbook';
import type Component from './SelectedDict.svelte';
import type { IDictionary } from '@living-dictionaries/types';
import { Timestamp } from 'firebase/firestore';

const dictionary: IDictionary =  {
  'updatedBy': 'U9u2OqBEArZSFV88Xu8TlvOWbbn1',
  'regions': [],
  'entryCount': 486,
  'name': 'Achi',
  'createdBy': 'T4qikh1eTafizvpmHNcG29uRQ2j1',
  'points': [],
  'location': 'Guatemala',
  'alternateNames': [],
  'glottocode': 'achi1256',
  'iso6393': 'acr',
  'glossLanguages': [
    'es',
    'en'
  ],
  'public': true,
  'id': 'achi',
  updatedAt: Timestamp.fromDate(new Date(2023, 7, 11, 15, 35, 54))
}

export const variants: Variant<Component>[] = [
  {
    name: 'Normal',
    languages: [],
    props: {
      dictionary
    }
  },
];
