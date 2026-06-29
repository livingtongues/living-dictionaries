/**
 * Substring filter used by `Filter.svelte`: an item matches when the
 * case-insensitive `query` appears anywhere in its JSON serialization. Because
 * it searches the serialized item, callers can make otherwise-hidden fields
 * searchable by adding them to the item (e.g. a localized display name that
 * only exists in i18n, not on the raw record — see `EditableGlossesField`).
 */
export function filter_items<T>({ items, query }: { items: T[], query: string }): T[] {
  const needle = query.toLowerCase()
  return items.filter(item => JSON.stringify(item).toLowerCase().includes(needle))
}
