# ✅ FIXED 2026-07-12 — Entries view shows a deleted entry until the next query (pre-existing)

**Resolution:** counter fix implemented (`tick()` was considered and rejected — it makes the
reducer async AND double-fires consumers on the true/false edges; a counter fires exactly once
per pulse). While fixing, found a THIRD cause: `entries/+page.svelte`'s effect read the store
behind `if (browser || $search_index_updated)` — short-circuit meant it was **never tracked as a
dependency** in the browser at all. Now `void $search_index_updated` unconditionally.
Touchpoints landed: worker-patch.ts (reducer + type), entries-ui-store.ts, worker-patch.test.ts,
entries/+page.svelte, _page.stories.ts. Verified: full suite 1539 ✅ / tsc / eslint / check 0
errors; new e2e `site/e2e/live-delete-refresh.mjs` (create → delete → list self-corrects to
baseline with zero input, deleted lexeme gone, no page errors); dict-home stories light+dark ✅.

**Follow-up ✅ FIXED 2026-07-12 — 3× delete-event fan-out deduped to exactly 1.** Traced the
three paths hitting the acting tab's `subscribe_deletes`:
1. Direct local `#notify_deletes` in `#delete`/`#dict_write` (dict-live-db.svelte.ts) — the
   comments assumed the worker broadcast only reached OTHER tabs, but a worker's
   BroadcastChannel post reaches its OWN tab's main thread too.
2. The worker `rows_deleted` broadcast echo (arrives before the RPC response — same ordered
   channel — so it's the keeper: exactly-once per tab, all tabs symmetric).
3. Sync pull echo: the server returns our own pushed tombstone in `response.deletes`; the
   engine's DELETE no-oped (row already gone) but `deleted_rows.push` was unconditional →
   another broadcast.
Fix: removed the direct notifies (1), kept the broadcast (2), and gated the sync-engine report
on `local.length > 0` (3) — a delete only reaches `on_rows_deleted` if it removed a row that
actually existed. Regression unit test added in dict-sync-engine.test.ts (echoed tombstone
skipped, genuine remote delete reported once). Verified live with a temp `[dedupe-probe]`
console instrument + throwaway e2e: create → delete → wait past the sync round-trip → exactly
**1** delete event for the entry id (was 3); `live-delete-refresh.mjs` still fully green
(self-correction now rides the broadcast). Full suite 1537 ✅ / tsc / eslint (no new) / lint
clean. house had the same sync-echo pattern (2× there: write-time `remove_ids` + echo; no
broadcast fan-out in its topology) — ported the exists-gate to its `worker-engine.ts` delete
apply (existence now queried for readonly too) + `worker-engine.delete-echo.test.ts`, verified
2026-07-12 (house suite 1859 ✅, tsc/lint/check clean, uncommitted).

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
