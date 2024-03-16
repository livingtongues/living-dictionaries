import { redirect, error } from '@sveltejs/kit';
import type { IDictionary, ExpandedEntry, ActualDatabaseEntry } from '@living-dictionaries/types';
import { collectionStore, getDocument, getCollection } from 'sveltefirets';
import type { LayoutLoad } from './$types';
import { ResponseCodes } from '$lib/constants';
import { writable, type Readable } from 'svelte/store';
import { browser } from '$app/environment';
import { limit } from 'firebase/firestore';
import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
import type { TranslateFunction } from '$lib/i18n/types';
import { tick } from 'svelte';

export const load: LayoutLoad = async ({ params: { dictionaryId }, parent }) => {
  try {
    const dictionary = await getDocument<IDictionary>(`dictionaries/${dictionaryId}`);
    const entries_page_count = 20
    const entries = create_entry_store(dictionaryId, parent, entries_page_count);

    if (dictionary)
      return { dictionary, entries, entries_page_count };
  } catch (err) {
    // only thrown if there was a db error
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err);
  }
  // reaches here if no dictionary
  redirect(ResponseCodes.MOVED_PERMANENTLY, '/');
};

function create_entry_store(dictionaryId: string, parent: () => Promise<{t: TranslateFunction}>, entries_page_count: number): Readable<ExpandedEntry[]> {
  if (!browser) {
    const { subscribe } = writable<ExpandedEntry[]>(null);
    return { subscribe };
  }

  const start = () => {
    let _teardown: () => void;

    async function listen_to_entries() {
      const { t } = await parent();

      const firebase_entries_first_set = await getCollection<ActualDatabaseEntry>(`dictionaries/${dictionaryId}/words`, [limit(entries_page_count)]);
      const expanded_entries = firebase_entries_first_set.map(entry => convert_and_expand_entry(entry, t));
      set(expanded_entries)
      console.info({first_set: expanded_entries.length})

      await tick()
      const entries = collectionStore<ActualDatabaseEntry>(`dictionaries/${dictionaryId}/words`, [], { startWith: firebase_entries_first_set });
      _teardown = entries.subscribe(firebase_entries => {
        if (firebase_entries !== firebase_entries_first_set) {

          const expanded_entries = firebase_entries.map(entry => convert_and_expand_entry(entry, t));
          set(expanded_entries)
          console.info({all_entries: expanded_entries.length})
        }
      });
    }
    listen_to_entries();

    return () => _teardown?.();
  }

  const store = writable<ExpandedEntry[]>(null, start);
  const { subscribe, set } = store;
  return { subscribe }
}
