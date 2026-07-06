# P2 — dict-engine `client_behind`/`schema_outdated` retries forever + logs unthrottled (40% of a day's log volume)

Found by the 2026-07-05 log review. **✅ FIXED at source 2026-07-05 15:38 UTC — commit `f66b209c`**
("Stop dict sync client_behind retry storm and fix log rollup user counts"): latches `schema_outdated`
on the per-dict engine (stops the 30s hammer), broadcasts recovery to all tabs, throttles the
telemetry, and hardens `snapshot_expired` entry-list retries. **Verified in prod by the 07-05 run-2
log review: ZERO `client_behind` storm rows on the fixed build (`1783265904035`)** — the only residual
is from pre-fix bundles on already-stuck backgrounded tabs (no deploy can reach those; they decay as
the tabs reload/close). Immediate manual mitigation for the persistent ones: reload the stuck tab
(admin Greg's own tab was the largest residual source). Left open only for the **dashboard** follow-up
(the "Sync health / stuck client_behind" panel, still in `.issues/future/dashboard-improvements.md`).

---

**Original finding (read-only, before the fix):**

## Symptom

In the last 24h, `client_logs.message = 'sync_failed'` totaled **9,862 warn rows** — **41.9% of ALL
24h logs (23,523)** and **89.7% of all warn-level rows (11,000)**. Of those, **9,681 rows carry
`context.kind = 'client_behind'`** (the rest is normal `network`/`snapshot_expired` traffic). This
single message dwarfs every other event today (next-largest: `perf` at 2,800).

Breakdown of the `client_behind` rows: **26 distinct (user, dict) tab-pairs**, **12 distinct users**
(11 named + 1 anonymous bucket spanning **34 different dictionaries**), spread continuously across
the full 24h+ window (rate ~run continuously since 2026-07-04T14:47, i.e. **>24h old and still
going** at review time). Named users hit, by row count:

| user | dicts | rows |
|---|---|---|
| Marlene Morales (marlene.vizuet@gmail.com, manager on zapoteco-de-analco) | 3 | 2,603 |
| **Gregory Anderson (livingtongues@gmail.com, admin L2)** | 3 (apatani, river, zapoteco-de-analco) | 2,220 |
| Chad Van Cleave (theonomist@gmail.com) | 1 (alu-kurumba) | 1,970 |
| ashutosh kumar | 1 (gta) | 407 |
| Trey Stewart | 1 (orich) | 86 |
| Jakub Urbanczyk | 1 (intergermanisch-sprak) | 51 |
| krukoffshyla | 1 (sugtstun) | 41 |
| + 4 more users, 1 dict each | | ≤6 each |
| anonymous (session_id present, user_id NULL) | 34 dicts | 2,346 |

**Even one of LD's own admins (Gregory) is affected** — 98.5% of his 24h event count is this noise,
not real activity. Jacob is NOT affected (his tabs reload often enough).

## Root cause (confirmed in code + data)

1. Today's new dict-migration `20260705_sentence_tokens_media_timings.sql` (added 03:30 UTC, part of
   the "texts pipeline" commit `ea76229a`, live in builds from ~02:17/09:52 UTC onward) advanced
   `LATEST_DICT_MIGRATION`. Any browser tab still running an OLDER bundle (cached, never reloaded)
   now declares a stale schema version on its next `/api/dictionary/[id]/changes` call →
   `site/src/routes/api/dictionary/[id]/changes/+server.ts:61` returns `409 CONFLICT` /
   `schema_outdated`.
2. **The per-dict sync engine never stops retrying.** `site/src/lib/db/dict-client/dict-sync-engine.ts`
   `sync_if_needed()` (called every 30s by the `start()` timer, `DICT_SYNC_INTERVAL_MS`) only checks
   `#in_flight` / `#stopped` — **unlike the admin engine (`$lib/db/sync/engine.svelte.ts`, which has a
   `blocked_by_client_behind` flag checked in both `sync_if_needed()` and `sync_on_resume()`), the dict
   engine has NO equivalent blocked-state flag at all.** `dict-instance.ts` `translate_sync_error()`
   (line ~191) only does `context.emit_event({ type: 'schema_outdated' })` on this error — it never
   calls `engine.stop()`. Compare to the `storage_lost` path in the same file
   (`reopen_after_storage_lost`), which explicitly calls `engine.stop()` once `MAX_REOPEN_ATTEMPTS` is
   exhausted specifically to prevent this class of hot-loop (added 2026-07-03 after an
   `AccessHandle is closed` incident) — the same treatment was never extended to `schema_outdated`.
3. **The failure ships completely unthrottled.** `site/src/lib/db/sync/sync-failure-classify.ts`
   `THROTTLED_KINDS` = `network, server_behind, auth, snapshot_expired, storage_lost` — **`client_behind`
   is deliberately excluded** (its docstring frames it as a rare, one-time "always ship" hard failure),
   so `report_dict_sync_failure()` (`report-dict-sync-failure.ts`) ships one row EVERY 30s, forever,
   per affected tab.
4. **There IS a recovery path, but it's not reliably closing the loop.** `[dictionaryId]/+layout.ts`
   subscribes to the `schema_outdated` broadcast and calls `recover_from_schema_outdated()`, which
   auto-reloads the tab (guarded to once per 30s via `sessionStorage` — `client-behind-recovery.ts`),
   falling back to a dismissible toast if the guard is hit again. This clearly isn't reaching (or isn't
   effective for) every affected tab — Marlene's rows are STILL on `app_version 1783096241136`
   (2026-07-03 build) after 36+ hours and presumably several `schema_outdated` broadcasts, and her
   session logged **zero** other event types (`sessions: 0`, no heartbeat/navigation) — i.e. this is a
   backgrounded/suspended tab whose worker keeps retrying while the tab itself isn't actively
   reloading/foregrounding. Possible contributors: background tab throttling delaying `location.reload()`
   effects, or the reload landing on a stale cached bundle (service worker / CDN) that still declares
   the old schema — the `client-behind-recovery.ts` docstring already anticipates this exact case
   ("stale SW/CDN, or a genuinely unavailable bundle").

## Why this matters

- **Log-volume/noise**: 41.9% of today's entire log stream, ~40% of the day's row growth in the new
  `logs.db` (197MB and growing) — driven by a mechanism that will recur after EVERY future
  dict-schema migration deploy, at whatever scale of "how many tabs are open across the deploy
  boundary."
- **100% invisible on both dashboards today** (verified against `log-analytics.ts`): `top_events`
  only aggregates `level = 'info'` rows (line ~904) and `error_clusters`/`errors_by_version` only
  count `('error','unhandled_rejection','crash')` (`ERROR_LEVELS_SQL`) — `sync_failed` ships at `warn`
  level (`sync_failure_level('client_behind') === 'warn'`), so it appears in NEITHER panel. Only a
  manual raw-table query surfaced this.
- **Latent data-integrity risk**: an editor whose tab is stuck in this loop can't push new dirty rows
  (the round-trip is push+pull in one call) until they reload onto a fresh bundle. Nobody appears to
  have lost work today (the affected users besides Gregory logged no edit activity in this window),
  but the mechanism means a future occurrence COULD silently strand an editor's saves for hours.

## Fix options

**✅ DONE (2026-07-05, immediate flood mitigation):**
1. Added `client_behind` to `THROTTLED_KINDS` in `sync-failure-classify.ts` (shared by both the admin
   and dict reporters) — a stuck tab now logs at most once per `SYNC_FAILURE_THROTTLE_MS` (10 min)
   instead of every 30s. New test: `should_ship_failure` "suppresses a repeat client_behind failure
   inside the window". Verified: `tsc` clean, lint clean, 360 tests pass in `src/lib/db` + `src/lib/search`.
   **This stops the log flood but NOT the retry loop itself** — the underlying `sync_if_needed()` still
   fires every 30s and still hits the server; only the shipped telemetry is now capped.
2. Lengthened the `snapshot_expired`-triggered bundle-read retry (Phase B #2, same review):
   `entries-ui-store.ts` `load_bundle_with_retry` now allows a SECOND retry (600ms instead of a single
   300ms) specifically when `snapshot_expired_recently(dictionary_id)` is true, since a full `reset()`
   (delete OPFS file + refetch snapshot over the network + reopen) is heavier than a normal reconnect.
   Non-snapshot-expired transient errors still get exactly one 300ms retry (unchanged fast path).

**✅ DONE (2026-07-05, durable fix — deep-dive session, uncommitted working tree):**
3. **`DictSyncEngine` now latches a `#version_blocked` flag** (`dict-sync-engine.ts`). Set in
   `sync_once()`'s catch when `classify_sync_failure(err) === 'client_behind'` (schema_outdated / 409);
   `sync_if_needed()` no-ops while set, so the 30s interval + post-write pushes stop hammering the
   server (mirrors the admin engine's `blocked_by_client_behind`). Fresh engines (reset / storage-lost
   reopen construct a NEW engine) start unblocked, so a reload/reopen naturally clears it. **This is the
   load-bearing fix.** New `on_version_blocked` option + `is_version_blocked` getter.
   `server_behind` (503 server_outdated) is deliberately NOT latched — it's transient (server
   mid-deploy) and self-heals on the next tick, exactly like the admin engine retries `ServerBehindError`.
   (This is a small, intentional divergence from the task's "client_behind/server_behind both stop
   retrying" wording — latching server_behind would strand a client that's already on the NEWEST bundle,
   which a reload can't fix; the admin engine's established behavior is to keep retrying it.)
4. **Root cause of the "recovery didn't close the loop" found + fixed.** The interval path
   (`sync_if_needed → sync_once`) **never called `translate_sync_error`** — that's only invoked from the
   `sync_now` RPC (initial load) and `reset()`. So a tab that loaded fine and went stale AFTER a deploy
   retried every 30s forever and **never emitted the `schema_outdated` broadcast** → `recover_from_schema_outdated`
   never fired. That's Marlene's backgrounded tab (loaded pre-deploy, never re-broadcast). The new
   `on_version_blocked` hook is wired in `dict-instance.ts` to `context.emit_event({ type: 'schema_outdated' })`,
   so the interval failure now broadcasts (once) → every tab reloads onto a fresh bundle.
   - **Stale-SW/CDN ruled out as the likely culprit**: the service worker (`service-worker.ts`) is
     network-first for navigations, so a reload fetches fresh HTML → fresh hashed asset URLs. Only
     `precached` hashed assets are cache-first (safe — new deploy = new URL).
   - **Instrumented for the wild**: `recover_from_schema_outdated` now `log_event`s `schema_outdated_reload`
     (info) right before `location.reload()` and `schema_outdated_reload_gave_up` (warn) on the toast
     fallback. The reload row's `app_version` is the stale bundle; if the very next `session_start`
     carries the SAME version, the reload re-served a stale bundle rather than picking up the deploy.
     The `pagehide` beacon flushes the row before the navigation tears the page down.
5. **DECISION: do NOT pause the engine on tab-hidden.** The dict engine runs inside the leader
   dedicated worker, which has no `document.visibilityState`/visibility events (main-thread/document
   concepts). A visibility-pause would need the main thread to signal the worker on every visibility
   change — added cross-thread plumbing that risks delaying a returning editor's pushes/pulls. The
   admin engine's `sync_on_resume` floor works only because it lives on the main thread. The
   `#version_blocked` latch already eliminates the pathological indefinite-retry case (stale bundle);
   a healthy backgrounded tab polling every 30s is cheap and pre-existing. Not worth the risk in this pass.

**Verification**: `pnpm vitest run src/lib/db` = 344 pass (incl. 10 new dict-sync-engine tests: block
latches + fires once + stops retrying; network does NOT block; server_behind does NOT block). `tsc
--noEmit` clean, `eslint` clean on touched files, `pnpm check` = 0 errors. A live browser repro was
NOT run — forcing a `schema_outdated` 409 in dev requires artificially desyncing `LATEST_DICT_MIGRATION`
between client bundle and server (both read the same constant in dev), which is fragile/invasive on the
shared box; the unit mocks reproduce the real server 409/503 responses exactly (verified against
`api/dictionary/[id]/changes/+server.ts:59-64`).

Re-run the verification queries below after this ships and confirm the `client_behind` rate drops to
~0 new (user,dict) pairs per subsequent migration deploy, and watch for `schema_outdated_reload` /
`schema_outdated_reload_gave_up` rows to confirm the auto-reload is now firing from the interval path.

## Phase C tie-in
See `.issues/future/dashboard-improvements.md` — "Sync health / stuck client_behind panel" proposal,
which would have caught this within the first hour instead of requiring a manual raw-log dig.

## Verification queries (VPS, read-only — see check-logs skill)
```js
// Rows/impact
SELECT COUNT(*) FROM client_logs WHERE message='sync_failed' AND json_extract(context,'$.kind')='client_behind' AND received_at >= <since>
// Distinct (user, dict) pairs
SELECT DISTINCT coalesce(user_id,'anon'), json_extract(context,'$.dict_id') FROM client_logs WHERE ...
```
Re-run after any fix ships and confirm the rate drops to ~0 (or at least to throttled-once-per-window).
