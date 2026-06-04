import { derived, readable } from 'svelte/store'
import type { EntryData, Tables } from '@living-dictionaries/types'
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
    // SSR: the per-dict content lives in the browser wa-sqlite dict.db (M4
    // write/sync), so render a placeholder; the client hydrates the entry from
    // the local dict.db via the entries_data store below. (A server-SQLite SSR
    // read for SEO can be a follow-up.)
    return {
      entry_from_page: loading_entry,
      shallow: false,
      entry_history,
    }
  }

  const { entries_data } = await parent()
  await new Promise((resolve) => {
    const unsub = entries_data.loading.subscribe((loading) => {
      if (!loading) {
        resolve(true)
        unsub()
      }
    })
  })

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
