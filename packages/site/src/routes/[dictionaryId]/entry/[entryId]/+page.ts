import { error, redirect } from '@sveltejs/kit'
import { get } from 'svelte/store'
import type { Tables } from '@living-dictionaries/types'
import { ResponseCodes } from '$lib/constants'
import { ENTRY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations'
import { browser } from '$app/environment'

export async function load({ params: { dictionaryId: dictionary_id, entryId: entry_id }, depends, parent }) {
  depends(ENTRY_UPDATED_LOAD_TRIGGER)

  if (browser) {
    const { entries } = await parent()
    if (!get(entries.loading)) {
      const entry = get(entries).find(entry => entry.id === entry_id)

      if (entry) {
        return {
          entry,
          shallow: false,
        }
      }
    }
  }

  const { supabase } = await parent()
  let entry: Tables<'entries_view'>

  const { data: entries, error: load_error } = await supabase
    .rpc('entry_by_id', {
      passed_entry_id: entry_id,
    })

  if (!load_error) {
    [entry] = entries
  } else {
    const { data: materialized_entries, error: materialized_load_error } = await supabase
      .from('materialized_entries_view')
      .select()
      .eq('id', entry_id)

    if (materialized_load_error) {
      error(ResponseCodes.INTERNAL_SERVER_ERROR, materialized_load_error)
    }

    [entry] = materialized_entries
  }

  if (!entry || entry.deleted)
    redirect(ResponseCodes.MOVED_PERMANENTLY, `/${dictionary_id}`)

  return {
    entry,
    shallow: false,
  }
}
