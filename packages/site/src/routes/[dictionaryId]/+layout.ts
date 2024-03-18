import { redirect, error } from '@sveltejs/kit';
import type { IDictionary, ExpandedEntry, ActualDatabaseEntry } from '@living-dictionaries/types';
import { collectionStore, getDocument, getCollection, docStore, docExists } from 'sveltefirets';
import type { LayoutLoad } from './$types';
import { ResponseCodes } from '$lib/constants';
import { writable, type Readable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { limit } from 'firebase/firestore';
import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
import type { TranslateFunction } from '$lib/i18n/types';
import { tick } from 'svelte';

export const load: LayoutLoad = async ({ params: { dictionaryId }, parent }) => {
  try {
    const dictionary_document = await getDocument<IDictionary>(`dictionaries/${dictionaryId}`);
    const dictionary = docStore(`dictionaries/${dictionaryId}`, { startWith: dictionary_document});

    const { t, user } = await parent();

    const is_manager: Readable<boolean> = derived(
      [user, dictionary],
      ([$user, $dictionary], set) => {
        if ($user) {
          if ($user?.roles?.admin > 0) {
            set(true);
          } else {
            docExists(`dictionaries/${$dictionary.id}/managers/${$user.uid}`)
              .then((exists) => set(exists))
              .catch((err) => {
                console.error('Manager checking error: ', err);
              });
          }
        } else {
          set(false);
        }
      }
    );

    const is_contributor: Readable<boolean> = derived(
      [user, dictionary],
      ([$user, $dictionary], set) => {
        if ($user) {
          docExists(`dictionaries/${$dictionary.id}/contributors/${$user.uid}`)
            .then((exists) => set(exists))
            .catch((err) => {
              console.error('Contributor checking error: ', err);
            });
        } else {
          set(false);
        }
      }
    );

    const can_edit: Readable<boolean> = derived(
      [is_manager, is_contributor],
      ([$isManager, $isContributor]) => $isManager || $isContributor
    );

    const entries_page_count = 20
    const entries = create_entries_store(dictionaryId, t, entries_page_count);

    if (dictionary_document)
      return { dictionary, entries, entries_page_count, is_manager, is_contributor, can_edit };
  } catch (err) {
    // only thrown if there was a db error
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err);
  }
  // reaches here if no dictionary
  redirect(ResponseCodes.MOVED_PERMANENTLY, '/');
};

function create_entries_store(dictionaryId: string, t: TranslateFunction, entries_page_count: number) {
  // TODO: use admin check instead
  const is_prod = window.location.origin.includes('livingdictionaries.app')
  if (!is_prod && !browser) {
    const { subscribe } = writable<ExpandedEntry[]>(null);
    return { subscribe };
  }
  console.info('creating entries store')

  const start = () => {
    let _teardown: () => void;

    async function listen_to_entries() {

      const firebase_entries_first_set = await getCollection<ActualDatabaseEntry>(`dictionaries/${dictionaryId}/words`, [limit(entries_page_count)]);
      const expanded_entries = firebase_entries_first_set.map(entry => convert_and_expand_entry(entry, t));
      set_entries_and_add_to_index(expanded_entries)
      console.info({first_set: expanded_entries.length})

      await tick()
      const entries = collectionStore<ActualDatabaseEntry>(`dictionaries/${dictionaryId}/words`, [], { startWith: firebase_entries_first_set });
      _teardown = entries.subscribe(firebase_entries => {
        if (firebase_entries !== firebase_entries_first_set) {

          const expanded_entries = firebase_entries.map(entry => convert_and_expand_entry(entry, t));
          set_entries_and_add_to_index(expanded_entries)
          console.info({all_entries: expanded_entries.length})
        }
      });
    }
    listen_to_entries();

    return () => _teardown?.();
  }

  const store = writable<ExpandedEntry[]>(null, start);
  const { subscribe, set } = store;

  function set_entries_and_add_to_index(entries: ExpandedEntry[]) {
    set(entries);
  }

  function search(query: string) {
    console.info('searching for', query)
  }

  return { subscribe, search }
}
