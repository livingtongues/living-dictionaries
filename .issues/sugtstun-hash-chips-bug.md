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

## Status: DONE (committed `d0c2fc5f`, pushed to main → deploying) ✅

## Fix applied ✅

- `ModalEditableArray.svelte`: key chips by unique `value`, not `name`
  (`{#each … as { value, name } (value)}`) — matches `MultiSelect.svelte`'s
  existing correct pattern. Stops the crash; names render even with duplicate
  names.
- Added `DuplicateNames` story reproducing 3×"above" + "Millie"; verified via
  svelte-look (renders cleanly, no crash).

All three approved follow-ups are done:
- ✅ **Write-side dedup** (`insert_tag`/`insert_dialect` reuse same-named rows,
  case-insensitive).
- ✅ **Deeper resilience** — `EntryDialect`/`EntryTag` fold the entry's own
  items into options so names resolve without the worker store.
- ✅ **Data dedup (Diego's entry)** — tombstoned the 2 extra "above" tags +
  their junctions on prod (`sugtstun.db`, backed up to `sugtstun.db.bak-…`).
  Bumped catalog `updated_at` so the next R2 sweep (≤30 min) rebuilds the
  snapshot. Entry now: tags "above" + "Millie", dialect "Lower Cook Inlet".

## Still open — needs Jacob's decision (SYSTEMIC, bigger than reported)

**sugtstun's tag table is riddled with duplicate-name tags** from the old
write behavior: `millie` ×98, `shane` ×30, `teglunaliq` ×19, `boil`/`boat` ×8,
plus ~50 more names with 2–7 copies each. The code fix stops NEW dupes, but a
one-time full-dictionary dedup pass (merge same-name tags → earliest, repoint
`entry_tags`, tombstone extras) would clean the existing mess. Likely affects
OTHER dictionaries too — worth a dedup migration/script across all dicts.
NOT run yet (out of the scope Jacob approved, which was just Diego's entry).
