import type { DictionaryEntryResponseBody } from './+server'

/**
 * Fetch one server-rendered entry for the reader's universal `+page.ts`.
 *
 * Takes the load's **injected `fetch`** (not `get_request`) so SvelteKit
 * resolves the SSR request in-process and reuses the response from the HTML
 * during hydration — no extra network call. Only invoked on SSR + the cold
 * warm-up window; warm client nav reads the entry from the local read-model.
 *
 * Never throws: an offline/failed fetch resolves to `{ entry: null }`, which
 * the load handles (404 / fall back to the warm store).
 */
export async function get_dict_entry({ fetch, dict_id, entry_id }: {
  fetch: typeof globalThis.fetch
  dict_id: string
  entry_id: string
}): Promise<DictionaryEntryResponseBody> {
  try {
    const response = await fetch(`/api/dictionary/${encodeURIComponent(dict_id)}/entry/${encodeURIComponent(entry_id)}`)
    if (!response.ok)
      return { entry: null }
    return await response.json() as DictionaryEntryResponseBody
  } catch {
    return { entry: null }
  }
}
