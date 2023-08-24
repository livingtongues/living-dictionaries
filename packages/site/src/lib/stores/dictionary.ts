import { writable } from 'svelte/store';
import type { IDictionary } from '@living-dictionaries/types';

export const dictionary = writable<IDictionary>({
  id: '',
  name: '---',
  public: false,
  entryCount: 0,
  glossLanguages: ['en'],
});

