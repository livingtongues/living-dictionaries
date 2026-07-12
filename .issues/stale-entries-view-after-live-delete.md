# Entries view shows a deleted entry until the next query (pre-existing)

Found 2026-07-12 while verifying the worker patch-union refactor. **Pre-existing** — reproduced
byte-identically on the pre-union code (git-stash A/B tested). Data layers are all CORRECT; this
is a view-refresh bug only.

## Repro (dev, achi)

1. On `/achi/entries`, Add Entry → type a lexeme → Next (navigates to the new entry page).
2. Delete the entry (button + confirm) → app navigates back to `/achi/entries`.
3. The list still shows the deleted entry / stale total (e.g. 487) — **indefinitely** (probed 15s+).
4. Typing anything in the search box (fresh query) shows the truth: entry gone, total 486.

## Diagnosis (instrumented)

- The local hard-delete DOES flow: `db.entries.delete` → `#notify_deletes` → orama-watcher
  `pending_deletes` → `apply_rows(deletes)` → store `entry_delete` patch + Orama `remove()`
  (verified: a forced fresh query returns 0 hits for the deleted id, browse total 486).
- The staleness has two cooperating causes:
  1. **Race**: the post-delete navigation remounts the entries page and runs its query
     immediately; the watcher (40ms debounce + async apply) hasn't processed the delete yet →
     renders the stale 487.
  2. **The `search_index_updated` pulse doesn't re-run the open query.** The store pulses
     `set(true); set(false)` SYNCHRONOUSLY (`create_patch_reducer` in
     `site/src/lib/search/worker-patch.ts`, same semantics as the pre-union
     `mark_search_index_updated`). Under Svelte 5 effect batching the consuming effect is
     scheduled once and reads the settled value `false` — the "true edge" is unobservable, so
     `entries/+page.svelte` / `[dictionaryId]/+page.svelte` never re-search. Creates appear to
     work live only because those flows happen to navigate (remount = fresh query).
- Side observation: the delete event arrives at the watcher **3× duplicated** (same
  `{table_name, id}` three times per delete). Idempotent downstream, but find the double-fan
  (likely `#notify_deletes` local + worker `rows_deleted` broadcast + ?) and dedupe.

## Recommended fix

Replace the boolean pulse with a **counter**: `search_index_updated: writable(0)` and
`update(n => n + 1)` in the reducer's `index_updated` case. Consumers re-run whenever the number
changes — no edge to miss, no batching hazard. Touchpoints: `worker-patch.ts` (reducer),
`entries-ui-store.ts` (store init), `entries/+page.svelte` + `[dictionaryId]/+page.svelte`
(consumers — both already just use it as an invalidation signal), `_page.stories.ts` mock
(`readable(false)` → `readable(0)`), and the reducer test's pulse assertions.

Keep the fix separate from the patch-union commit so behavior change is reviewable on its own.
