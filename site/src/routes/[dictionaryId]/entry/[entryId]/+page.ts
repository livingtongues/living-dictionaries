import { derived, get } from 'svelte/store'
import { error } from '@sveltejs/kit'
import type { EntryData } from '$lib/types'
import { browser } from '$app/environment'
import { ResponseCodes } from '$lib/constants'
import { get_dict_entry } from '$api/dictionary/[id]/entry/[entryId]/_call'

/**
 * Isomorphic entry load (universal, no `+page.server.ts` → warm entry→entry nav
 * never triggers a `__data.json` ping). The single entry is sourced:
 *
 *  - **SSR + cold warm-up window:** from the `/api/dictionary/[id]/entry/[id]`
 *    endpoint via the load's `fetch` (in-process on SSR; reused-from-HTML on
 *    hydration). Gives real content + OG meta on first paint without waiting on
 *    the full dict.db snapshot.
 *  - **Warm client:** from the local read-model (`entries_data`) — zero network.
 *
 * `entry_from_page` is the resolved SSR/cold entry; `derived_entry` is the live
 * read-model row that swaps in (and stays reactive to edits/sync) once the dict
 * bundle finishes loading.
 */
export async function load({ params: { entryId: entry_id }, parent, fetch }) {
  const { dictionary, entries_data } = await parent()

  async function fetch_entry(): Promise<EntryData | null> {
    const { entry } = await get_dict_entry({ fetch, dict_id: dictionary.id, entry_id })
    return entry
  }

  if (!browser) {
    const entry = await fetch_entry()
    if (!entry)
      error(ResponseCodes.NOT_FOUND, 'Entry not found')
    return { entry_from_page: entry, shallow: false }
  }

  const derived_entry = derived([entries_data], ([$entries_data]) => $entries_data[entry_id] ?? null)

  // Warm: the bundle has finished loading (+layout.ts awaits sync before the
  // store is built, and `loading` flips false only after the full bundle is
  // assembled — so an absent entry here is genuinely missing).
  if (!get(entries_data.loading)) {
    if (get(entries_data)[entry_id])
      return { derived_entry, shallow: false }
    const entry = await fetch_entry()
    if (!entry)
      error(ResponseCodes.NOT_FOUND, 'Entry not found')
    return { entry_from_page: entry, shallow: false }
  }

  // Cold window: paint the server entry now (reused from the SSR HTML on
  // hydration → no extra network), then hand over to the live read-model.
  const entry = await fetch_entry()
  if (!entry)
    error(ResponseCodes.NOT_FOUND, 'Entry not found')
  return { entry_from_page: entry, derived_entry, shallow: false }
}
