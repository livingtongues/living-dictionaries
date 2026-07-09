# Search bar + pagination frozen on entries page (prod regression)

User report (confirmed): typing in the entries search bar does nothing; changing pages
doesn't update entries until a full refresh.

## Root cause ✅

Regression from `10154e30` (deployed 2026-07-08, the effect-loop fix). The new deep-equal
emit dedupe in `createQueryParamStore.setStoreValue` kept its baseline `store_value` as the
**same object reference it emits to subscribers**. Svelte compiles
`bind:value={$search_params.query}` (SearchInput) and `bind:page_from_url={$search_params.page}`
(Pagination) to "mutate the emitted object in place, then `set(sameObject)`" — so by the time
the `goto` URL echo came back through `setStoreValue`, the aliased baseline already contained
the new value → `deep_equal` matched → emit skipped → the search `$effect` never re-ran.
URL updated, results froze. One root cause, both symptoms.

## Fix ✅

`site/src/lib/state/query-param-state.svelte.ts`: keep `store_value` as an independent
`structuredClone` (at init and on every accepted emit) so in-place bind mutations can't
corrupt the dedupe baseline.

## Verification ✅

- New regression test in `query-param-state.svelte.test.ts` ("an in-place mutation of the
  emitted object still emits") simulating the exact bind compilation (mutate emitted object →
  `set(sameObject)`), covering keystroke + pagination mutations. 7/7 pass.
- Headless e2e against dev (`/achi/entries`): typing "juyub" filters 485 → 3 results;
  page-2 click renders entries 21-40. Reverting the fix reproduces both failures
  (search_worked=false, pagination_worked=false).
- tsc + eslint clean on touched files.

## Notes

- Local dev shared.db had an empty `dictionaries` catalog; inserted a minimal `achi` row
  (dict.db already existed with 485 entries) to make `/achi/entries` resolvable for testing.
- Known pre-existing wart (not touched): on mount with no `?q=`, the URL effect's initial
  run coerces null → `{}` and clobbers `startWith` — page defaults are recovered downstream
  (`$search_params.page - 1 || 0`), but the store never actually holds `startWith`.
