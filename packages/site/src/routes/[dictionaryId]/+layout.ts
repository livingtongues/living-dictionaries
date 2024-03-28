import { redirect, error } from '@sveltejs/kit';
import type { IDictionary, ISpeaker } from '@living-dictionaries/types';
import { docExists, awaitableDocStore, collectionStore } from 'sveltefirets';
import type { LayoutLoad } from './$types';
import { ResponseCodes } from '$lib/constants';
import { type Readable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { where } from 'firebase/firestore';
import { dbOperations } from '$lib/dbOperations';
import { create_entries_store } from './load-entries';

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
    const { entries, status, search_entries } = create_entries_store({dictionary: initial_doc, is_admin: !!user_from_cookies?.roles?.admin, t, entries_per_page});

    return { dictionary, speakers, entries_per_page, entries, status, search_entries, is_manager, is_contributor, can_edit, dbOperations };
  } catch (err) {
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err);
  }
};
