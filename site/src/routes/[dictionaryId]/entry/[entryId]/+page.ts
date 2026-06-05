import { derived } from 'svelte/store'
import type { EntryData } from '$lib/types'
import { browser } from '$app/environment'

export async function load({ params: { entryId: entry_id }, parent }) {
  const loading_entry = { id: entry_id, main: { lexeme: { default: 'Loading...' } }, senses: [{}] } as unknown as EntryData

  if (!browser) {
    // SSR: the per-dict content lives in the browser wa-sqlite dict.db (M4
    // write/sync), so render a placeholder; the client hydrates the entry from
    // the local dict.db via the entries_data store below. (A server-SQLite SSR
    // read for SEO can be a follow-up.)
    return {
      entry_from_page: loading_entry,
      shallow: false,
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
  }
}
