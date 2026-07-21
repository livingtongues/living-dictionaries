# Entries filters fail to cross the search-worker boundary

## Production evidence — 2026-07-20

- 🔴 **P1 current-build regression:** 450 structured-clone errors across 59 human sessions, 8 signed-in users, and 19 dictionary entry-list routes in the rolling 24-hour window.
- All rows are on build `1784516782010`; first seen `2026-07-20T03:09:09Z`, nine minutes after commit `db5ff11f` (the query-parameter rune rewrite) was committed/deployed.
- Browser breadth: Chrome 274 rows / 37 sessions; Safari 128 / 16; Edge 29 / 4; Firefox 19 / 2.
- Messages are browser variants of the same failure: `[object Array] could not be cloned`, `The object can not be cloned`, and `Proxy object could not be cloned`.
- Every replay points to `/{dictionary}/entries?q=...` after a filter or page selection. Search does not complete for the selected filter. Forty-two of 59 sessions continued doing something afterward, but none emitted a later `dict_changes_pushed` in the same session.

## Verified root cause

Commit `db5ff11f` migrated the entries filter query params from a Svelte store to `QueryParamState`, whose `value` is a deep Svelte `$state` proxy. In `site/src/routes/[dictionaryId]/entries/+page.svelte`, the search effect shallow-spreads `search_params.value`:

```ts
search({ ...search_params.value, scope }, current_page_index)
```

The outer object becomes plain, but nested arrays such as `parts_of_speech`, `speakers`, and other multi-select filters remain Svelte proxies. `site/src/lib/search/index.ts` then passes this options object to Comlink's worker proxy. Structured clone rejects those nested proxies before the Orama worker can search.

The current code is still unguarded; no later commit fixes or snapshots this worker payload.

## Recommended fix

- [x] ✅ Snapshot the whole query-param value before the Comlink call (`f4c3d8bc`). The bare-route follow-ups are `fc83af67` (wait for index readiness) and `33ef5987` (normalize `null` page to index 0).
- [ ] Add a regression test with nested filter arrays, not only scalar query/page values. The test must exercise the real worker/Comlink boundary or assert that its payload is cloneable; a direct `search_entries.ts` unit test will miss this class.
- [x] ✅ Verified the deployed `/gta/entries` bare route in a fresh Chromium browser: 20 entry links, `Entries: 1-20 / 6378`, no page errors.
- [x] ✅ Production telemetry audit at 2026-07-21 03:06 UTC: zero clone variants on every repaired/current build across Chrome, Safari, and Firefox. Two Safari rows at 00:21 UTC were from one continuously-open stale tab on broken build `1784516782010`, not a repaired build. Chrome's last occurrence was 23:50 UTC and Firefox's was 18:50 UTC on 2026-07-20.
