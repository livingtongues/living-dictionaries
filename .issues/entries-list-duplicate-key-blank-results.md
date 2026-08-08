# A duplicate entry id blanks the whole entries results list

> ## 🔴 2026-08-07 — THE REMAINING CAUSE IS PROVEN, AND IT IS NOT THE ENTRY ID. FIX THIS.
>
> The top-level de-dupe below shipped and works; the guard kept firing anyway (5 rows on 2026-08-07,
> 5 sessions, 3 anonymous visitors, `san-sebastian-del-monte-m` ×4 and `birhor` ×1). The live cause is
> **one level down**, in <File path="site/src/routes/[dictionaryId]/entries/list/ListEntry.svelte" line="248" />:
>
> ```svelte
> {#each first_sense.semantic_domains || [] as domain (domain)}
> ```
>
> The key is the semantic-domain **string**, and some senses store the same domain twice. Confirmed by
> reading the production content databases:
>
> ```
> san-sebastian-del-monte-m  entry 7XtLEJMhPIqq2mifh88w  semantic_domains = ["1.5","1.5"]
> birhor                     entry nrYYv4YFKvpbJg8VUxK8  semantic_domains = ["3","3"]
> birhor                     entry Lnmt4eKCpKJGhdJ5eVrW  semantic_domains = ["2","2"]
> tanacross                  2 senses (not yet observed failing — nobody browsed its list)
> ```
>
> **Blast radius (all 1,315 production dictionary databases scanned, 2026-08-07): 3 dictionaries,
> 5 senses.** Small — but for those three, EVERY visitor to the entries list gets a blank results
> area, signed in or not, because the throw escapes to `View.svelte`'s `<svelte:boundary>` after the
> whole page of results has been discarded.
>
> **Fix, in this order:**
> 1. **Render:** key line 248 by index instead of by the domain string (or de-duplicate in the derived
>    value). Line 224 (`Object.entries(sentence.text)` keyed by `bcp`) and line 199 (keyed by
>    `sense.id`) are safe — checked.
> 2. **Data:** clean the 5 offending senses.
> 3. **Telemetry (optional):** `entries_view_render_failed` reports `dict_id`, `view`, `entry_count`
>    and the first five entry ids — none of which name the duplicated key. Finding this took a scan of
>    1,315 databases. Parse the offending value out of Svelte's `each_key_duplicate` message.
>
> *(This supersedes the 2026-08-02/08-03 "prime suspect" note in `.cron/log-reviews/decisions.md`.)*

> ✅ **FIXED (uncommitted) 2026-08-03** — tracked in `.issues/nightly-fixes-2026-08-03.md` item 3.
> `$lib/utils/dedupe-entries-list.ts` runs once in `View.svelte` before all three views consume
> `entries`, and emits `entries_list_duplicate_key { dict_id, dup_id, view, entry_count, query }`.
> The boundary stays as the backstop. Recurred a second time on 2026-08-02 (`birhor`, list view,
> 20 entries) before this landed. Delete this file once Jacob commits.

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
