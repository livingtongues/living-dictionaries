import { redirect, error } from '@sveltejs/kit';
import type { IDictionary, ExpandedEntry, ActualDatabaseEntry, ISpeaker } from '@living-dictionaries/types';
import { docExists, firebaseConfig, awaitableDocStore, collectionStore, incrementalCollectionStore } from 'sveltefirets';
import type { LayoutLoad } from './$types';
import { ResponseCodes } from '$lib/constants';
import { writable, type Readable, derived, type Unsubscriber } from 'svelte/store';
import { browser } from '$app/environment';
import { limit, orderBy, where } from 'firebase/firestore';
import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
import type { TranslateFunction } from '$lib/i18n/types';
import { create_index, search_entries } from '$lib/search';
import { dbOperations } from '$lib/dbOperations';

export const load: LayoutLoad = async ({ params: { dictionaryId }, parent }) => {
  try {
    const dictionary = await awaitableDocStore<IDictionary>(`dictionaries/${dictionaryId}`);
    const { error: firestore_error, initial_doc } = dictionary
    if (firestore_error)
      error(ResponseCodes.INTERNAL_SERVER_ERROR, firestore_error);

    if (!initial_doc)
      redirect(ResponseCodes.MOVED_PERMANENTLY, '/');

    const { t, user, user_from_cookies } = await parent();

    const is_manager: Readable<boolean> = derived(
      [user, dictionary],
      ([$user, $dictionary], set) => {
        if (!$user) return set(false)
        if ($user.roles?.admin > 0) return set(true)
        if (!browser) return set(false)

        docExists(`dictionaries/${$dictionary.id}/managers/${$user.uid}`)
          .then((exists) => set(exists))
          .catch((err) => {
            console.error('Manager checking error: ', err);
          });
      }
    );

    const is_contributor: Readable<boolean> = derived(
      [user, dictionary],
      ([$user, $dictionary], set) => {
        if (!$user) return set(false)
        if (!browser) return set(false)
        docExists(`dictionaries/${$dictionary.id}/contributors/${$user.uid}`)
          .then((exists) => set(exists))
          .catch((err) => {
            console.error('Contributor checking error: ', err);
          });
      }
    );

    const can_edit: Readable<boolean> = derived([is_manager, is_contributor], ([$is_manager, $is_contributor]) => $is_manager || $is_contributor);

    const speakers = collectionStore<ISpeaker>('speakers', [where('contributingTo', 'array-contains', dictionaryId)], { startWith: []})

    const entries_per_page = 20
    const { initial_entries, search_index_updated, search_entries } = create_entries_store({dictionary: initial_doc, is_admin: !!user_from_cookies?.roles?.admin, t, entries_per_page});

    return { dictionary, speakers, entries_per_page, initial_entries, search_index_updated, search_entries, is_manager, is_contributor, can_edit, dbOperations };
  } catch (err) {
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err);
  }
};

function create_entries_store({dictionary, is_admin, t, entries_per_page}: { dictionary: IDictionary, is_admin: boolean, t: TranslateFunction, entries_per_page: number}) {
  const initial_entries = writable<ExpandedEntry[]>(null);

  const load_entries_locally = browser && (is_admin || firebaseConfig.projectId === 'talking-dictionaries-dev')
  if (!load_entries_locally)
    return { initial_entries };

  const search_index_updated = writable<boolean>(false, start);

  function start() {
    let teardown: Unsubscriber;
    let first_set_received = false

    incrementalCollectionStore<ActualDatabaseEntry>(`dictionaries/${dictionary.id}/words`, { initialQueryConstraints: [limit(entries_per_page), orderBy('ua', 'desc')]}).then(entries_store => {
      teardown = entries_store.subscribe(firebase_entries => {
        const expanded_entries = firebase_entries.map(entry => convert_and_expand_entry(entry, t));

        if (!first_set_received) {
          console.info({ first_set: expanded_entries.length })
          first_set_received = true
          initial_entries.set(expanded_entries)
          if (expanded_entries.length < dictionary.entryCount)
            return
        }

        console.info({ all_entries: expanded_entries.length })
        create_index(expanded_entries).then(() => search_index_updated.set(true))
      });
    })

    return () => teardown?.();
  }

  return { initial_entries, search_index_updated, search_entries }
}
