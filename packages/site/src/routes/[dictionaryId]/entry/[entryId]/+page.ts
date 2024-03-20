import { error, redirect } from '@sveltejs/kit';
import type { ActualDatabaseEntry } from '@living-dictionaries/types';
import { docStore, getDocument } from 'sveltefirets';
import { browser } from '$app/environment';
import { derived, readable } from 'svelte/store';
import { ResponseCodes } from '$lib/constants';
import { ENTRY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations';
import { getSupabase } from '$lib/supabase';
import type { SupaEntry } from '$lib/supabase/database.types.js';
import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';

export const load = async ({ params, depends, parent }) => {
  depends(ENTRY_UPDATED_LOAD_TRIGGER)

  const entryPath = `dictionaries/${params.dictionaryId}/words/${params.entryId}`;

  let entryInitial: ActualDatabaseEntry;
  try {
    entryInitial = await getDocument<ActualDatabaseEntry>(entryPath);
  } catch (err) {
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err);
  }

  if (!entryInitial)
    redirect(ResponseCodes.MOVED_PERMANENTLY, `/${params.dictionaryId}`);

  const { t } = await parent()

  let entry = readable(convert_and_expand_entry(entryInitial, t))
  if (browser) {
    try {
      const db_entry_store = docStore<ActualDatabaseEntry>(entryPath, {startWith: entryInitial})
      entry = derived(db_entry_store, $entry => convert_and_expand_entry($entry, t))
    } catch (err) {
      error(ResponseCodes.INTERNAL_SERVER_ERROR, err);
    }
  }

  const supabase = getSupabase()

  const { data, error: supaError } = await supabase
    .from('entries_view')
    .select()
    .eq('id', params.entryId)
    .returns<SupaEntry[]>()

  const supaEntry = data?.[0]
  console.info({ supaEntry, supaError })

  return {
    actualEntry: entryInitial,
    entry,
    supaEntry,
    shallow: false,
  };
};
