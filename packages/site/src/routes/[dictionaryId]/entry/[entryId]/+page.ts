import { error, redirect } from '@sveltejs/kit';
import type { ActualDatabaseEntry } from '@living-dictionaries/types';
import { docStore, getDocument } from 'sveltefirets';
import {
  admin,
  algoliaQueryParams,
  canEdit,
  dictionary,
  isContributor,
  isManager,
  user,
} from '$lib/stores';
import { browser } from '$app/environment';
import { readable } from 'svelte/store';
import { getUpdateSense } from '$lib/supabase/change/sense';
import { saveUpdateToFirestore } from '$lib/helpers/entry/update';

export const load = async ({ params }) => {
  try {
    const entryPath = `dictionaries/${params.dictionaryId}/words/${params.entryId}`;
    const entry = await getDocument<ActualDatabaseEntry>(entryPath);
    if (!entry)
      throw redirect(301, `/${params.dictionaryId}`);

    let entryStore = readable(entry)
    if (browser)
      entryStore = docStore<ActualDatabaseEntry>(entryPath, {startWith: entry})

    return {
      initialEntry: entryStore,
      admin,
      algoliaQueryParams,
      canEdit,
      dictionary,
      isContributor,
      isManager,
      user,
      saveUpdateToFirestore,
      updateSense: getUpdateSense(params.dictionaryId)
    };
  } catch (err) {
    throw error(500, err);
  }
};
