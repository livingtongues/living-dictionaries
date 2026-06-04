/**
 * Reconcile a reactive `rows` array + `objects` map with a fresh snapshot
 * from the DB, preserving the order returned by the SQL ORDER BY clause.
 *
 * Mutates both arguments in place so Svelte 5 fine-grained reactivity can
 * track per-row column changes without replacing array/object identity.
 */
export function reconcile_rows<T extends Record<string, unknown>>(options: {
  rows: T[]
  objects: Record<string, T>
  fresh_rows: T[]
  row_key: (row: Record<string, unknown>) => string
  on_row_added: (row: T) => void
}): void {
  const { rows, objects, fresh_rows, row_key, on_row_added } = options

  const fresh_by_key = new Map<string, T>()
  const fresh_order: string[] = []
  for (const row of fresh_rows) {
    const key = row_key(row)
    fresh_by_key.set(key, row)
    fresh_order.push(key)
  }

  // Remove rows that no longer exist
  for (let index = rows.length - 1; index >= 0; index--) {
    const key = row_key(rows[index])
    if (!fresh_by_key.has(key)) {
      rows.splice(index, 1)
      delete objects[key]
    }
  }

  // Update existing rows in place (columns only, not order)
  const existing_keys = new Set<string>()
  for (const row of rows) {
    const key = row_key(row)
    existing_keys.add(key)
    const fresh = fresh_by_key.get(key)
    if (fresh) {
      for (const col of Object.keys(fresh)) {
        if ((row as Record<string, unknown>)[col] !== fresh[col]) {
          (row as Record<string, unknown>)[col] = fresh[col]
        }
      }
    }
  }

  // Walk fresh_order and make rows[target_index] match fresh_order[target_index]
  // by either inserting a new row or moving an existing one into place.
  for (let target_index = 0; target_index < fresh_order.length; target_index++) {
    const desired_key = fresh_order[target_index]
    const current_key = target_index < rows.length
      ? row_key(rows[target_index])
      : undefined

    if (current_key === desired_key)
      continue

    if (!existing_keys.has(desired_key)) {
      const fresh = fresh_by_key.get(desired_key) as T
      rows.splice(target_index, 0, fresh)
      const inserted = rows[target_index]
      on_row_added(inserted)
      objects[desired_key] = inserted
      existing_keys.add(desired_key)
    } else {
      let source_index = target_index + 1
      while (
        source_index < rows.length
        && row_key(rows[source_index]) !== desired_key
      ) {
        source_index++
      }
      if (source_index < rows.length) {
        const [moved] = rows.splice(source_index, 1)
        rows.splice(target_index, 0, moved)
      }
    }
  }
}

if (import.meta.vitest) {
  interface Row extends Record<string, unknown> {
    id: string
    title: string
    created_at: string
  }
  const row_key = (row: Record<string, unknown>) => String(row.id)
  const noop = () => { /* unused callback in these tests */ }

  describe(reconcile_rows, () => {
    it('initial populate places rows in fresh_rows order', () => {
      const rows: Row[] = []
      const objects: Record<string, Row> = {}
      const fresh: Row[] = [
        { id: 'b', title: 'B', created_at: '2' },
        { id: 'a', title: 'A', created_at: '1' },
      ]
      reconcile_rows({ rows, objects, fresh_rows: fresh, row_key, on_row_added: noop })
      expect(rows.map(row => row.id)).toEqual(['b', 'a'])
      expect(Object.keys(objects).sort()).toEqual(['a', 'b'])
    })

    it('deleted rows are removed and order of remaining is preserved', () => {
      const rows: Row[] = [
        { id: 'a', title: 'A', created_at: '1' },
        { id: 'b', title: 'B', created_at: '2' },
        { id: 'c', title: 'C', created_at: '3' },
      ]
      const objects: Record<string, Row> = { a: rows[0], b: rows[1], c: rows[2] }
      const fresh: Row[] = [
        { id: 'a', title: 'A', created_at: '1' },
        { id: 'c', title: 'C', created_at: '3' },
      ]
      reconcile_rows({ rows, objects, fresh_rows: fresh, row_key, on_row_added: noop })
      expect(rows.map(row => row.id)).toEqual(['a', 'c'])
      expect(objects.b).toBeUndefined()
    })

    it('existing row identity is preserved when columns update', () => {
      const original: Row = { id: 'a', title: 'A', created_at: '1' }
      const rows: Row[] = [original]
      const objects: Record<string, Row> = { a: original }
      const fresh: Row[] = [{ id: 'a', title: 'A renamed', created_at: '1' }]
      reconcile_rows({ rows, objects, fresh_rows: fresh, row_key, on_row_added: noop })
      expect(rows[0]).toBe(original)
      expect(rows[0].title).toBe('A renamed')
    })

    it('on_row_added fires once per new row', () => {
      const rows: Row[] = []
      const objects: Record<string, Row> = {}
      const fresh: Row[] = [
        { id: 'a', title: 'A', created_at: '1' },
        { id: 'b', title: 'B', created_at: '2' },
      ]
      const added: string[] = []
      reconcile_rows({
        rows,
        objects,
        fresh_rows: fresh,
        row_key,
        on_row_added: row => added.push(String(row.id)),
      })
      expect(added).toEqual(['a', 'b'])
      expect(objects.a).toBe(rows[0])
      expect(objects.b).toBe(rows[1])
    })
  })
}
