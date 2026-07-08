# Entry-page `effect_update_depth_exceeded` — the shared `?q=` query-param store feeds back into the URL

**Filed:** 2026-07-07 (log review, run 2 · 21:00 UTC). **Severity:** was 🔴 P1 — broad reach on a
core flow (entry detail), and **growing daily**. **Status:** ✅ **FIXED + tested 2026-07-08.**

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

## Root cause

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

On the entry page the entries list stays mounted underneath (SvelteKit **shallow routing** — the entry
opens as a `pushState` overlay in `entries/View.svelte`), so the entries `search_params` store is
alive on the entry URL — which is why the loop logged 100% on `/{dict}/entry/*`.

The loop: the URL effect called `writable.set()` on **every** URL change, emitting a **fresh object
identity** even when the parsed value was logically unchanged. Downstream `$derived`/two-way `bind:`
consumers re-derived and wrote the (equal) value back through `setQueryParam → goto`, changing
`page.url`, re-running the effect → `set()` → … until Svelte tripped `effect_update_depth_exceeded`.
The `reading 'page'` / `setting 'query'` variants are the same store racing against `page` being
momentarily undefined during entry↔entry navigation.

Before `af2ec863` the store used the old `$app/stores` `page.subscribe(...)` (no rune effect), which
did not participate in Svelte 5's effect-flush graph the same way — hence ~zero of these before 07-04.

## Fix (three guards, all in `query-param-state.svelte.ts`)

1. **Deep-equal dedupe before `set()`** — track the last value pushed into the writable (`store_value`)
   and skip the emit when the newly-parsed URL value `deep_equal`s it. No redundant object identity →
   no downstream churn. New util `$lib/utils/deep-equal.ts` (`deep_equal`, key-order-insensitive for
   objects, order-significant for arrays; fully inline-tested).
2. **No-op navigation guard in `setQueryParam`** — compared **deeply** against the current URL param
   (so a key-reordered echo `{query,page}` vs the URL's `{page,query}` is recognized as identical) —
   skip the `goto` entirely.
3. **Re-entrancy flag** (`applying_store_value`) around `set()` — a synchronously-resolving
   shallow/`pushState` navigation can't re-enter `handle_search_params` mid-emit.

## Test harness

Added a second vitest **project** so runes actually execute (the node `unit` project never touched
`.svelte.ts`): `vitest.config.ts` now has `unit` (node) + **`reactive`** (`svelte()` plugin +
`resolve.conditions:['browser']` + `happy-dom`), mirroring tutor's `vitest.config.component.ts`.
`pnpm test` runs both.

- New mocks: `$lib/mocks/app-state.svelte.ts` (a `$state` `page`) + `$lib/mocks/app-navigation.ts`
  (a `goto` that updates the happy-dom URL **and** `page.url`). So a `goto` the store fires feeds back
  through **real Svelte reactivity** — a reintroduced loop actually manifests in the test.
- `query-param-state.svelte.test.ts` drives the real store: new-value nav+emit, no-op nav guard,
  key-reordered dedupe (no re-emit), a write-back subscriber **reaching a steady state** (the loop
  regression guard), external nav to a new value, and malformed-scalar `?q=hua` coercion.

Verified: `pnpm vitest run` (1341 pass), `pnpm lint` clean, `pnpm check` 0 errors.

## Related

- `.issues/entry-page-effect-loop-residual.md` — the earlier star-effect strand of the same
  entry-page loop (the `page.params.entryId`-stable-dependency fix). This query-param store was the
  remaining source that fix's write-up predicted ("there is at least one more source").
- The **entries table-view** `RangeError: Maximum call stack size exceeded` (Sk@/Qk@ mutual
  recursion, `/highlander/entries?q={"view":"table",…}`) is a *separate* recursion on the same
  entries surface — track it alongside but it's a different code path (table renderer, not the
  query-param store). See `.issues/highlander-table-view-stack-overflow-2026-07-07.md`.
- Confirm in prod: next log review should show `effect_update_depth_exceeded` on the current build
  drop toward ~0.
