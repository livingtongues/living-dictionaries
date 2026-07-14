// Minimal mock of a `dict_db` reactive collection for svelte-look stories:
// exposes the `.rows` / `.loading` / `.id(id)` surface the components read.
export function mock_collection<T extends { id: string }>(rows: T[] = []) {
  return {
    rows,
    loading: false,
    id: (id: string) => rows.find(row => row.id === id),
  }
}

/** Assemble a mock `dict_db` from named collections of rows. */
export function mock_dict_db(collections: Record<string, { id: string }[]>) {
  const db: Record<string, ReturnType<typeof mock_collection>> = {}
  for (const [name, rows] of Object.entries(collections))
    db[name] = mock_collection(rows)
  return db
}
