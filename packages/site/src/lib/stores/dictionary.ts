import { writable } from 'svelte/store';
import type { IDictionary, IEntry } from '@living-dictionaries/types';

export const dictionary = writable<IDictionary>({
  id: '',
  name: '---',
  public: false,
  entryCount: 0,
  glossLanguages: ['en'],
});

export const entries = writable<IEntry[]>([]);
