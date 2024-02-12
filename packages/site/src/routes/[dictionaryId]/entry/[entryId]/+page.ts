import { error, redirect } from '@sveltejs/kit';
import type { ActualDatabaseEntry, SupaEntry } from '@living-dictionaries/types';
import { docStore, getDocument } from 'sveltefirets';
import {
  admin,
  algoliaQueryParams,
  canEdit,
  dictionary_deprecated as dictionary,
  isContributor,
  isManager,
  user,
} from '$lib/stores';
import { browser } from '$app/environment';
import { readable } from 'svelte/store';
import { ResponseCodes } from '$lib/constants';
import { ENTRY_UPDATED_LOAD_TRIGGER, dbOperations } from '$lib/dbOperations';
import { getSupabase } from '$lib/supabase';

export const load = async ({ params, depends }) => {
  depends(ENTRY_UPDATED_LOAD_TRIGGER)

  const entryPath = `dictionaries/${params.dictionaryId}/words/${params.entryId}`;

  let entry: ActualDatabaseEntry;
  try {
    entry = await getDocument<ActualDatabaseEntry>(entryPath);
  } catch (err) {
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err);
  }

  if (!entry)
    redirect(ResponseCodes.MOVED_PERMANENTLY, `/${params.dictionaryId}`);

  let entryStore = readable(entry)
  if (browser) {
    try {
      entryStore = docStore<ActualDatabaseEntry>(entryPath, {startWith: entry})
    } catch (err) {
      error(ResponseCodes.INTERNAL_SERVER_ERROR, err);
    }
  }

  const supabase = getSupabase()

  const { data, error: supaError } = await supabase
    .from('entries_view')
    .select()
    .eq('id', params.entryId)

  const supaEntry = data?.[0]  as any as SupaEntry
  console.info({ supaEntry, supaError })

  return {
    initialEntry: entryStore,
    supaEntry,
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
