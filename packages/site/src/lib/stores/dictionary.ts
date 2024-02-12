import { writable } from 'svelte/store';
import type { IDictionary } from '@living-dictionaries/types';

/** @deprecated use dictionary from layout data instead */
export const dictionary_deprecated = writable<IDictionary>({
  id: '',
  name: '---',
  public: false,
  entryCount: 0,
  glossLanguages: ['en'],
});

