import { error, redirect } from '@sveltejs/kit'
import { get, readable } from 'svelte/store'
import type { Tables } from '@living-dictionaries/types'
import { ResponseCodes } from '$lib/constants'
import { ENTRY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations'
import { browser } from '$app/environment'

export async function load({ params: { entryId: entry_id }, depends, parent }) {
  depends(ENTRY_UPDATED_LOAD_TRIGGER)

  const entry_history = readable<Tables<'content_updates'>[]>([], (set) => {
    (async () => {
      const { supabase } = await parent()
      const { data: entry_content_updates, error } = await supabase.from('content_updates')
        .select('*')
        .eq('entry_id', entry_id)
        .order('timestamp', { ascending: false })
      if (error) {
        console.error(error)
        return []
      }
      if (entry_content_updates.length) set(entry_content_updates)
    })()
  })

  if (browser) {
    const { entries } = await parent()
    if (!get(entries.loading)) {
      const entry = get(entries).find(entry => entry.id === entry_id)

      if (entry) {
        return {
          entry,
          shallow: false,
          entry_history,
        }
      }
    }
  }

  const { supabase, dictionary } = await parent()
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
    redirect(ResponseCodes.MOVED_PERMANENTLY, `/${dictionary.id}`)

  return {
    entry,
    shallow: false,
    entry_history,
  }
}
