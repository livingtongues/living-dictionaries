# Highlander table-view `RangeError: Maximum call stack size exceeded` (`Sk@/Qk@`)

**Severity:** was 🟠 (100% on `/highlander/entries?q={view:table}`). **Found:** 2026-07-07 log review.
**Status:** ✅ **Defensive boundary + guard-log SHIPPED 2026-07-08 (uncommitted — Jacob approved the
option, reviews/commits).** Root cause is a CLIENT-LOCAL anomaly, NOT reproducible on current code +
representative data (see investigation below) — so no recursion "fix" exists to ship; the boundary
stops it white-screening and makes any recurrence self-identify.

## ✅ Shipped (2026-07-08) — `<svelte:boundary>` + guard-log

`entries/View.svelte` now wraps the whole results render (list / table / gallery / print switch) in a
Svelte 5 `<svelte:boundary>`:
- `onerror` → `browser`-guarded `log_warning({ message: 'entries_view_render_failed', context: {
  dict_id, view, entry_count, first_entry_ids: entries.slice(0,5).map(e=>e.id), error } })` — mirrors
  the `entry_render_duplicate_key` guard-log pattern.
- `{#snippet failed}` → a small centered fallback (`misc.error` + a `misc.reload` reset button) instead
  of a white screen.

**Verified in a real browser (headless puppeteer):** injected a forced throw into `EntriesTable`'s
`$derived` → the fallback rendered (i18n'd, no white-screen) and a `/api/log` POST carried
`entries_view_render_failed` with `dict_id:"highlander", view:"table", entry_count:2,
first_entry_ids:[…e081336a…], error:"…"`. Injection reverted; `pnpm check` 0 errors, 1341 tests pass,
lint clean. **The NEXT real occurrence will now name the dictionary + the exact first entry ids** so the
culprit row/data is queryable instead of a useless `Sk↔Qk` stack.

## What the logs show
- `RangeError: Maximum call stack size exceeded.`, stack = pure `@\nSk@\nQk@\nSk@\nQk@…` (two minified
  functions mutually recursing), `context.lineno:39 colno:89`.
- **58 rows / 3 anonymous sessions**, ALL on **one build** `app_version 1783431428497`
  (= 2026-07-07T13:37 UTC), 07-07 17:28→20:41. URLs: `/highlander/entries?q={view:table[,query:…]}`
  for many queries (`Fatal`,`Dawn`,`fear`,`Fear`,`f`,`F`), **empty `{view:table}` (all 725 entries)**,
  and `semantic_domains:["2__4"]` / `["3__2"]` filters. i.e. it crashed for those viewers on
  **essentially any** highlander table view, regardless of result set.

## Why it's a client-local anomaly, not a live code defect
- **The code is unchanged.** Build `1783431428497` is code-identical to current HEAD `95abffb2`
  (origin/main tip; `git log HEAD..origin/main` is empty). The "6 later builds" seen in logs are
  **redeploys of the same commit** (each redeploy mints a new `app_version` epoch).
- **Zero recurrence** across all 6 subsequent redeploys of that same code — the error stopped dead
  after that one build/day.
- **Reproduced the exact crashing URLs on the exact code** against a **fresh copy of the production
  `highlander.db`** (725 entries incl. the `Fatal`/`Iniji`/`Fatai` matches, pulled via better-sqlite3
  `.backup()` into local `.data/dictionaries/highlander.db`): `{view:table}` (all entries),
  `semantic_domains:["2__4"]`, `query:"fear"/"Dawn"/"Fatal"` — **all render cleanly, zero errors**
  (headless puppeteer, `page.on('pageerror')`).
- **Every structural `Sk↔Qk` candidate ruled out:** `xss` `sanitize` (the one recursive-looking call
  on the cell render path, `Textbox.svelte`) is **iterative** — verified it does NOT overflow even at
  60,000-deep nested tags; scanning all 2,968 highlander text leaves through `sanitize` never threw.
  `EntrySemanticDomains` maps a **flat** `semanticDomains` list (no tree walk). `assemble_entry_data`
  is **flat, deduped, cycle-free** (no related-entry recursion — related entries aren't in the
  read-model). `preferred_table_columns` is a JSON `createPersistedStore` (can't be circular);
  `setUpColumns` does flat `splice`s.

Most consistent explanation: that browser's **local wa-sqlite `highlander.db` (or transient runtime
state) was corrupted** into a shape the render path recursed on — a condition the server never had
(so unreproducible from server data), which self-cleared on reload. Same class as the client-local
`each_key_duplicate` corruption (`.issues/entry-page-duplicate-key-crash.md`).

## Recommendation (NOT applied — needs Jacob's ok; a blind recursion fix is against repo policy)
No unbounded-recursion construct is identifiable in the table path, and the repo forbids blind
reactive/recursion edits without a reproduction. The safe, established-pattern option:
- Wrap the entries **table** (and ideally list) render in a Svelte 5 `<svelte:boundary>` with a
  `failed` snippet + a guard-log (`entries_table_render_failed`, `{ dict_id, first_entry_ids }`) —
  mirroring the `entry_render_duplicate_key` guard-log adopted for the sibling client-local bug. This
  can't "fix" the recursion (no repro), but it (a) stops a future occurrence white-screening the
  viewer and (b) makes the next occurrence **name its context** instead of a useless `Sk↔Qk` stack.

## Repro assets (local, gitignored)
- `.data/dictionaries/highlander.db` replaced with a fresh prod backup (725 entries). The old empty
  stale copy was 0-entries; no `.stale-bak` retained.
