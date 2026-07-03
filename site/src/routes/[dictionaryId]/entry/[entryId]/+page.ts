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

  // A just-written entry exists in the local wa-sqlite DB before the
  // orama-watcher feeds it into the read-model AND before the sync engine
  // pushes it to the server — so "absent from the store + absent from the
  // server" can be a race, not a missing entry (add-new-headword → goto hit
  // this constantly). Give the watcher a bounded window to deliver the row
  // before 404ing.
  function wait_for_local_entry(timeout_ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false
      let unsubscribe = () => {}
      let timer: ReturnType<typeof setTimeout>
      function settle(found: boolean) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        // subscribe fires synchronously on registration — unsubscribe isn't
        // assigned yet on that first call, hence the microtask.
        queueMicrotask(() => unsubscribe())
        resolve(found)
      }
      timer = setTimeout(() => settle(false), timeout_ms)
      unsubscribe = entries_data.subscribe(($entries_data) => {
        if ($entries_data[entry_id])
          settle(true)
      })
    })
  }

  // Warm: the bundle has finished loading (+layout.ts awaits sync before the
  // store is built, and `loading` flips false only after the full bundle is
  // assembled) — an absent entry is either just-created (see above) or
  // genuinely missing.
  if (!get(entries_data.loading)) {
    if (get(entries_data)[entry_id])
      return { derived_entry, shallow: false }
    // Local-first: a just-written entry reaches the read-model in well under a
    // second — trust the local feed before burning a server round-trip (which
    // also makes offline add-word fully self-sufficient).
    if (await wait_for_local_entry(1500))
      return { derived_entry, shallow: false }
    const entry = await fetch_entry()
    if (entry)
      return { entry_from_page: entry, derived_entry, shallow: false }
    if (await wait_for_local_entry(3000))
      return { derived_entry, shallow: false }
    error(ResponseCodes.NOT_FOUND, 'Entry not found')
  }

  // Cold window: paint the server entry now (reused from the SSR HTML on
  // hydration → no extra network), then hand over to the live read-model.
  const entry = await fetch_entry()
  if (!entry)
    error(ResponseCodes.NOT_FOUND, 'Entry not found')
  return { entry_from_page: entry, derived_entry, shallow: false }
}
