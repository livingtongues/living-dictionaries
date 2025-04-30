import { redirect } from '@sveltejs/kit'
import { get, readable } from 'svelte/store'
import type { Tables } from '@living-dictionaries/types'
import { ResponseCodes } from '$lib/constants'
import { ENTRY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations'
import { browser } from '$app/environment'
import type { EntryData } from '$lib/search/types.js'

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
    const { entries_data } = await parent()
    if (!get(entries_data.loading)) {
      const entry = get(entries_data).find(entry => entry.id === entry_id)

      if (entry) {
        return {
          entry,
          shallow: false,
          entry_history,
        }
      }
    }
  }

  const entry = { senses: [{}] } as EntryData // TODO: load this in

  if (!entry || entry.deleted) {
    const { dictionary } = await parent()
    redirect(ResponseCodes.MOVED_PERMANENTLY, `/${dictionary.id}`)
  }

  return {
    entry,
    shallow: false,
    entry_history,
  }
}
