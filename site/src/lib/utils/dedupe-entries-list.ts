import { browser } from '$app/environment'
import { log_warning } from '$lib/debug/remote-log'
import { dedupe_by_id } from './dedupe-by-id'

/**
 * De-dupe the top-level entries results array feeding the three keyed
 * `{#each entries as entry (entry.id)}` blocks (list / table / gallery) AND,
 * when a duplicate id is present, ship an `entries_list_duplicate_key` warn
 * naming the duplicated id.
 *
 * Without this a single duplicated id throws Svelte's `each_key_duplicate`,
 * `View.svelte`'s `<svelte:boundary>` catches it, and the visitor's search
 * results render as an empty area with no explanation (two occurrences,
 * `.issues/entries-list-duplicate-key-blank-results.md`). The boundary stays as
 * the backstop for everything else.
 *
 * The dupe is expected to come from the client-local Orama index rather than
 * server data — which is exactly why the warn must name `dup_id`: if this ever
 * fires with server-side ids it is an editor-facing data problem, not a
 * corrupt local index. Do not downgrade it to a silent swallow.
 */
export function dedupe_entries_list<T extends { id: string }>({ entries, dict_id, view, query }: {
  entries: T[]
  dict_id?: string | null
  view?: string | null
  query?: string | null
}): T[] {
  const deduped = dedupe_by_id(entries)
  // Only the browser ships telemetry; SSR data is clean (the corruption is
  // client-local), and log_warning's localStorage path is worth avoiding on the server.
  if (browser && deduped.length !== entries.length) {
    const seen = new Set<string>()
    for (const entry of entries) {
      if (seen.has(entry.id)) {
        log_warning({
          message: 'entries_list_duplicate_key',
          context: {
            dict_id: dict_id ?? null,
            dup_id: entry.id,
            view: view ?? 'list',
            entry_count: entries.length,
            query: query ?? null,
          },
        })
      }
      seen.add(entry.id)
    }
  }
  return deduped
}

if (import.meta.vitest) {
  describe(dedupe_entries_list, () => {
    it('returns the same contents when there are no duplicates', () => {
      const entries = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
      expect(dedupe_entries_list({ entries, dict_id: 'birhor', view: 'list', query: '' })).toEqual(entries)
    })

    it('keeps the first occurrence of a duplicated id', () => {
      const first = { id: 'a', v: 1 }
      const entries = [first, { id: 'b', v: 2 }, { id: 'a', v: 3 }]
      expect(dedupe_entries_list({ entries, dict_id: 'birhor' })).toEqual([first, { id: 'b', v: 2 }])
    })

    it('handles an empty array', () => {
      expect(dedupe_entries_list({ entries: [] })).toEqual([])
    })
  })
}
