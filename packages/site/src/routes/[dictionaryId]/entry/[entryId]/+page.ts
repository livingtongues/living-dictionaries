import { redirect } from '@sveltejs/kit'
import { derived, readable } from 'svelte/store'
import type { EntryData, Tables } from '@living-dictionaries/types'
import { ResponseCodes } from '$lib/constants'
import { browser } from '$app/environment'

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

  const loading_entry = { id: entry_id, main: { lexeme: { default: 'Loading...' } }, senses: [{}] } as unknown as EntryData

  if (!browser) {
    const { dictionary, supabase } = await parent()
    const cached = await load_cache(dictionary.id)
    if (cached) {
      const entry = cached.find(entry => entry.id === entry_id)
      if (entry) {
        return {
          entry_from_page: entry,
          shallow: false,
          entry_history,
        }
      }
    }

    const { data: single_entry } = await supabase.from('entries').select('deleted').eq('id', entry_id).single()
    if (!single_entry || single_entry.deleted) {
      redirect(ResponseCodes.MOVED_PERMANENTLY, `/${dictionary.id}`)
    }

    return {
      entry_from_page: loading_entry,
      shallow: false,
      entry_history,
    }
  }

  const { entries_data } = await parent()
  const derived_entry = derived([entries_data], ([$entries_data]) => {
    const entry = $entries_data[entry_id]
    if (entry) {
      return entry
    }
    return loading_entry
  })

  return {
    derived_entry,
    shallow: false,
    entry_history,
  }
}

async function load_cache(dictionary_id: string) {
  const url = `https://cache.livingdictionaries.app/entries_data/${dictionary_id}.json`
  try {
    console.info('loading cached entries_data')
    const response = await fetch(url)
    if (!response.ok) {
      console.info('cached entries_data not found')
      return null
    }
    const serialized_json = await response.text()
    console.info('got cached entries_data')
    const deserialized = JSON.parse(serialized_json) as EntryData[]
    console.info('parsed cached entries_data')
    return deserialized
  } catch (err) {
    console.error('Error loading cached index', err)
    return null
  }
}
