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
import { ErrorCodes } from '$lib/constants';
import { dbOperations } from '$lib/dbOperations';

export const load = async ({ params }) => {
  const entryPath = `dictionaries/${params.dictionaryId}/words/${params.entryId}`;

  let entry: ActualDatabaseEntry;
  try {
    entry = await getDocument<ActualDatabaseEntry>(entryPath);
  } catch (err) {
    throw error(ErrorCodes.INTERNAL_SERVER_ERROR, err);
  }

  if (!entry)
    throw redirect(ErrorCodes.MOVED_PERMANENTLY, `/${params.dictionaryId}`);

  let entryStore = readable(entry)
  if (browser) {
    try {
      entryStore = docStore<ActualDatabaseEntry>(entryPath, {startWith: entry})
    } catch (err) {
      throw error(ErrorCodes.INTERNAL_SERVER_ERROR, err);
    }
  }

  return {
    initialEntry: entryStore,
    supaEntry: { senses: []},
    admin,
    algoliaQueryParams,
    canEdit,
    dictionary,
    isContributor,
    isManager,
    user,
    dbOperations,
  };
};
