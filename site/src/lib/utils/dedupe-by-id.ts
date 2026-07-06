/**
 * Keep the first occurrence of each `id`, preserving order. Guards the keyed
 * `{#each … (row.id)}` blocks on the entry surfaces against duplicate child rows
 * — a duplicated junction row in a client's local dict DB (a pre-`24b080b1`
 * sync artifact that the ordering fix stops creating but can't heal) otherwise
 * throws Svelte's `each_key_duplicate` and blanks the whole entry page.
 * See `.issues/entry-page-duplicate-key-crash.md`.
 */
export function dedupe_by_id<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    if (seen.has(row.id))
      continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

if (import.meta.vitest) {
  describe(dedupe_by_id, () => {
    it('returns the same array contents when there are no duplicates', () => {
      const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
      expect(dedupe_by_id(rows)).toEqual(rows)
    })

    it('keeps the first occurrence of each id and preserves order', () => {
      const first = { id: 'a', v: 1 }
      const dup = { id: 'a', v: 2 }
      expect(dedupe_by_id([first, { id: 'b', v: 3 }, dup])).toEqual([first, { id: 'b', v: 3 }])
    })

    it('handles an empty array', () => {
      expect(dedupe_by_id([])).toEqual([])
    })
  })
}
