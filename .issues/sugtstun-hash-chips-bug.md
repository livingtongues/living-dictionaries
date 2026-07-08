# Dialect / custom-tag chips render raw UUIDs ("a hash") — Diego's sugtstun report

Reported by Diego in chat (2026-07-08): on `sugtstun` entry
`29990c25-7b28-432c-af82-3ae6fc2e50da`, the **Dialect** and **Custom tags** fields
show UUIDs instead of names. Other entries are fine.

## Root cause (two intertwined bugs)

The entry data is **correct** — the SSR-fetched `/api/dictionary/.../entry/...`
payload has the real names (`"Lower Cook Inlet"`, `"above"` ×3, `"Millie"`).

1. **Display resolves names from the wrong source.** `EntryDialect.svelte` /
   `EntryTag.svelte` throw away the names on the entry's own dialect/tag objects,
   keep only the ids, and re-resolve names from the **dictionary-wide store**
   (`page.data.dialects` / `page.data.tags`, fed by the Orama worker). Before that
   store is populated (SSR + first client paint), `ModalEditableArray`'s
   `prepareSelected` falls back to `{ value, name: value }` → renders the raw UUID.

2. **`each_key_duplicate` crash freezes it there.** `ModalEditableArray` keyed its
   chips `{#each … as { name } (name)}`. This entry has **three tags all named
   "above"**, so once the store loads and the chips try to re-render with real
   names, Svelte throws `each_key_duplicate` (confirmed in Diego's console
   screenshot), aborting the effect flush and leaving BOTH fields stuck on the
   pre-load UUID state. Entry-specific because only this entry has collision-named
   tags.

## Fix applied ✅

- `ModalEditableArray.svelte`: key chips by unique `value`, not `name`
  (`{#each … as { value, name } (value)}`) — matches `MultiSelect.svelte`'s
  existing correct pattern. Stops the crash; names render even with duplicate
  names.
- Added `DuplicateNames` story reproducing 3×"above" + "Millie"; verified via
  svelte-look (renders cleanly, no crash).

## Still open (needs Jacob's call)

- **Production data dedup**: sugtstun has 3 tags named "above"
  (`8fb4cb6f…`, `3dc6fb74…`, `08da6c3e…`) all on this entry. Merge into one +
  tombstone extras? (per-dict write → propagates via next R2 snapshot rebuild)
- **Write-side dedup gap**: `EntryTag.on_update`'s write-in path always
  `insert_tag`s a new tag; it never dedups by name against existing tags, and if
  the dictionary store is empty when editing it can't see existing tags at all —
  this is how the 3 "above" dupes got created.
- **Deeper resilience (optional)**: have `EntryDialect`/`EntryTag` use the name
  already on the entry's own object as the display source, removing the
  pre-worker-load UUID flash entirely.
