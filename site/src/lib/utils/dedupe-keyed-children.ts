import { browser } from '$app/environment'
import { log_warning } from '$lib/debug/remote-log'
import { dedupe_by_id } from './dedupe-by-id'

/**
 * The id-keyed child lists rendered in the entry page's `{#each … (row.id)}`
 * blocks. Used as the `child_kind` field of the `entry_render_duplicate_key`
 * guard-log so a future duplicate names its exact list.
 */
export type EntryChildKind = 'senses' | 'audios' | 'photos' | 'videos' | 'sentences' | 'related_entries'

/**
 * De-dupe an id-keyed child array feeding a keyed `{#each … (row.id)}` block AND,
 * when a duplicate id is present, ship an `entry_render_duplicate_key` warn so the
 * offending list identifies itself in telemetry instead of throwing a minified
 * `each_key_duplicate` that blanks the whole entry page.
 *
 * This covers the render paths `assemble_entry_data`'s dedupe can't reach — the
 * live `dict_db` query in `RelatedEntries` and the cross-sense-flattened
 * photo/video arrays in `EntryMedia` (the same media linked to two senses dupes
 * even though assemble dedupes per-sense). See
 * `.issues/entry-page-duplicate-key-crash.md`.
 */
export function dedupe_keyed_children<T extends { id: string }>({ rows, child_kind, entry_id, dict_id }: {
  rows: T[]
  child_kind: EntryChildKind
  entry_id: string
  dict_id?: string | null
}): T[] {
  const deduped = dedupe_by_id(rows)
  // Only the browser ships telemetry; SSR data is clean (the corruption is
  // client-local), so a server-side dupe never happens — and log_warning's
  // localStorage/console path is a no-op worth avoiding on the server.
  if (browser && deduped.length !== rows.length) {
    const seen = new Set<string>()
    for (const row of rows) {
      if (seen.has(row.id))
        log_warning({ message: 'entry_render_duplicate_key', context: { entry_id, child_kind, dup_id: row.id, dict_id: dict_id ?? null } })
      seen.add(row.id)
    }
  }
  return deduped
}

if (import.meta.vitest) {
  describe(dedupe_keyed_children, () => {
    it('returns the same contents when there are no duplicates', () => {
      const rows = [{ id: 'a' }, { id: 'b' }]
      expect(dedupe_keyed_children({ rows, child_kind: 'senses', entry_id: 'e1' })).toEqual(rows)
    })

    it('keeps the first occurrence of a duplicated id', () => {
      const first = { id: 'a', v: 1 }
      const rows = [first, { id: 'b', v: 2 }, { id: 'a', v: 3 }]
      expect(dedupe_keyed_children({ rows, child_kind: 'photos', entry_id: 'e1', dict_id: 'd1' })).toEqual([first, { id: 'b', v: 2 }])
    })
  })
}
