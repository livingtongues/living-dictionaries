# Entry-detail page reactive loop: `effect_update_depth_exceeded` (+ `reading 'page'` / `setting 'query'`)

**Filed:** 2026-07-07 (log review, run 2 · 21:00 UTC). **Severity:** 🔴 P1 — broad reach on a core
flow (entry detail), and **growing daily**. Read-only review — NOT yet fixed.

## Symptom (from prod `client_logs`)

- **`Uncaught Error: https://svelte.dev/e/effect_update_depth_exceeded`** — a Svelte reactive
  (`$effect`) loop that exceeds the update-depth guard and throws.
- **100% of occurrences are on entry-detail pages** `/{dictionaryId}/entry/{id}?q=…` (route bucket
  query confirmed: `{ entry: 170 }`, zero elsewhere). Multiple dictionaries (`sugtstun`,
  `appalachian`, …) and **169 distinct sessions** in 24h (only 7 signed-in users — mostly anonymous
  public visitors), i.e. it hits a large slice of entry-page visitors ~once each, not one looping tab.
- **Growing fast:** 13 (07-04) → 6 (07-05) → 47 (07-06) → **170 (07-07)**.
- Minified stack is Svelte's effect-flush recursion: `Ne → Or → br → br → br …` (chunk
  `Ctv-SBfO.js`), i.e. an effect that keeps re-dirtying its own dependency.

Two sibling errors cluster on the **same** entry URLs (`/sugtstun/entry/…?q={"query":"g"}`), almost
certainly the same root cause surfacing during teardown/navigation:
- `Uncaught TypeError: Cannot read properties of undefined (reading 'page')` (×8)
- `Cannot set properties of undefined (setting 'query')` (×8) and `set page_from_url … setting 'page'` (×2)

## Root-cause hypothesis (grounded)

The trend **exactly correlates** with commit **`af2ec863`** (2026-07-04 03:57 UTC, "Add homepage v2
preview, featured-words admin, and converge lib layout"), which rewrote
`site/src/lib/state/query-param-state.svelte.ts` to read the URL via `$app/state`'s rune-reactive
`page` inside an `$effect.root`:

```ts
const start = () => {
  handle_search_params(page.url.searchParams)   // sync first read
  return $effect.root(() => {
    $effect(() => {
      handle_search_params(page.url.searchParams) // re-runs on EVERY page.url change
    })
  })
}
```

`handle_search_params` → `setStoreValue` → `set(parsed_value)` notifies store subscribers. The
entries/entry `?q=` store is **read-write**: the entry page uses it to preserve the search context
for prev/next pagination, and a consumer writing back (`setQueryParam` → `goto(...)`) mutates
`page.url`, which re-fires the `$effect`, which sets the store again → the `br → br → br` flush loop
that trips `effect_update_depth_exceeded`. The `reading 'page'` / `setting 'query'` variants are the
same store racing against `page` being momentarily undefined during entry↔entry navigation.

Before `af2ec863` the store used the old `$app/stores` `page.subscribe(...)` (no rune effect), which
did not participate in Svelte 5's effect-flush graph the same way — hence ~zero of these before 07-04.

## Recommended fix (NOT applied — needs the owner's eyes)

Break the store↔URL feedback in the rune effect. Options, cheapest first:
1. **Dedupe harder before `set`.** In `handle_search_params`, bail when the parsed value is
   value-equal to the current store value (not just when the raw `searchParams` string is identical —
   `current_params_value` only compares the raw string, so a `goto` that reorders params or a
   store-driven write still passes through). A deep/JSON compare against the last emitted value would
   stop the self-trigger.
2. **Untrack the write path.** Ensure the write side (`setQueryParam`/`goto`) can't be seen as a
   dependency of the read `$effect` — or guard re-entrancy with a `writing` flag so a store-initiated
   `goto` doesn't loop back into `setStoreValue`.
3. Confirm the entry page isn't independently `set()`-ing the `?q=` store on mount (which would race
   the effect). If it is, make that a one-time init, not reactive.

Verify by loading `/{dict}/entry/{id}?q={"query":"g"}` in a real browser, paginating prev/next, and
watching the console for `effect_update_depth_exceeded`. Because the store factory is shared, also
re-check the entries list, texts, and any other `createQueryParamStore` consumer for regressions.

## Related this run
- The **entries table-view** `RangeError: Maximum call stack size exceeded` (Sk@/Qk@ mutual
  recursion, `/highlander/entries?q={"view":"table",…}`) is a *separate* recursion on the same
  entries surface — track it alongside but it's a different code path (table renderer, not the
  query-param store). ~57 rows/24h, concentrated in a couple of table-view sessions on `highlander`.
