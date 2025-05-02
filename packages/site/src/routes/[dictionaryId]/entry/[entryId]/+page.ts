import { redirect } from '@sveltejs/kit'
import { derived, readable } from 'svelte/store'
import type { Tables } from '@living-dictionaries/types'
import { ResponseCodes } from '$lib/constants'
import { browser } from '$app/environment'
import type { EntryData } from '$lib/search/types.js'

export async function load({ params: { entryId: entry_id }, parent }) {
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

  const cached_entry = { id: entry_id, main: { lexeme: { default: 'Loading...' } }, senses: [{}] } as unknown as EntryData

  if (!browser) {
    // TODO: load this in the server
    if (!cached_entry || cached_entry.deleted) {
      const { dictionary } = await parent()
      redirect(ResponseCodes.MOVED_PERMANENTLY, `/${dictionary.id}`)
    }

    return {
      entry_from_page: cached_entry,
      shallow: false,
      entry_history,
    }
  }

  const { entries_data } = await parent()
  const derived_entry = derived([entries_data, entries_data.loading], ([$entries_data, $loading]) => {
    const entry = $entries_data.find(entry => entry.id === entry_id)
    if (entry) {
      return entry
    }
    if ($loading) {
      return cached_entry
    }
    return null
  })

  return {
    derived_entry,
    shallow: false,
    entry_history,
  }
}
