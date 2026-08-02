# A duplicate entry id blanks the whole entries results list

Filed by the nightly log review, 2026-08-01. One anonymous visitor, one dictionary, reproducible
shape.

## What happened

2026-08-01 08:23 UTC, `https://livingdictionaries.app/birhor/entries?q={"semantic_domains":["2"],"page":5}`
emitted two `entries_view_render_failed` rows (`repeat_count: 2` on the second):

```
dict_id: "birhor", view: "list", entry_count: 16,
error: "https://svelte.dev/e/each_key_duplicate"
```

The breadcrumbs show a real browsing session — entry clicks, "Show More", page 2 → 10 → 11 — that
walked into semantic-domain page 5 and got nothing. `View.svelte`'s `<svelte:boundary onerror>`
caught the throw (that guard did its job — this was legible instead of a white screen), but a caught
boundary renders **nothing**, so the visitor saw an empty results area with no explanation.

## Root cause shape

`site/src/routes/[dictionaryId]/entries/View.svelte:61` — and the two sibling views,
`table/EntriesTable.svelte:55` and `EntriesGallery.svelte:15` — all render
`{#each entries as entry (entry.id)}` over the array handed down from the search results. Svelte
throws `each_key_duplicate` the moment two rows share an id.

The entry PAGE's child lists were already hardened for exactly this (`$lib/utils/dedupe-keyed-children.ts`,
`.issues/entry-page-duplicate-key-crash.md`) — senses, audios, photos, videos, sentences, related
entries all dedupe and emit `entry_render_duplicate_key`. **The top-level entries list was never
covered**, even though `View.svelte:31` refers to that helper in a comment.

The duplicate almost certainly arrives from the client-local Orama index (`$lib/search/`), not from
server data — same client-local-corruption family as the highlander stack overflow. Which is why the
fix belongs at the render boundary regardless of where the dupe came from.

## Fix

1. De-dupe `entries` once, in `View.svelte`, before all three views consume it — `dedupe_by_id` is
   already there (`$lib/utils/dedupe-by-id.ts`).
2. Emit a named warn when it fires, matching the entry-page convention:
   `entries_list_duplicate_key { dict_id, dup_id, view, entry_count, query }`. Today the only signal
   is the generic boundary log, which cannot say *which* entry duplicated.
3. Keep the boundary — it stays the backstop for anything else.

Cost is a few lines; the payoff is that a corrupt local index degrades to "one row appears once"
instead of "your search returns nothing".
