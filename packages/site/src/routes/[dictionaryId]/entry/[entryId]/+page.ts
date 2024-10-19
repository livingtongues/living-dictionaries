import { error, redirect } from '@sveltejs/kit'
import { get } from 'svelte/store'
import { ResponseCodes } from '$lib/constants'
import { ENTRY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations'
import { browser } from '$app/environment'

export async function load({ params, depends, parent }) {
  depends(ENTRY_UPDATED_LOAD_TRIGGER)

  if (browser) {
    const { entries } = await parent()
    if (!get(entries.loading)) {
      const entry = get(entries).find(entry => entry.id === params.entryId)

      if (entry) {
        return {
          entry,
          shallow: false,
        }
      }
    }
  }

  const { supabase } = await parent()
  const { data: entries, error: load_error } = await supabase
    .from('entries_view')
    .select()
    .eq('id', params.entryId)

  if (load_error)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, load_error)

  const [entry] = entries

  if (!entry || entry.deleted)
    redirect(ResponseCodes.MOVED_PERMANENTLY, `/${params.dictionaryId}`)

  return {
    entry,
    shallow: false,
  }
}
