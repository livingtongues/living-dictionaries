# Log-review fixes — 2026-07-03 action items

From `.cron/log-reviews/2026-07-03.md`. Building the approved fixes.

## Items
- [x] ✅ 🟠 **P1 investigation: tuscarora `AccessHandle is closed` failures.** RESOLVED — see findings:
  read-only anonymous visitor, ZERO edits at risk, 80-min loop (not 5h) in an unwatched background tab.
- [x] ✅ 🟠 Classify OPFS-lifecycle errors as benign: new `storage_lost` kind (warn + 10-min throttle)
  + `is_storage_lost_error()` in `sync-failure-classify.ts`. Tests added.
- [x] ✅ 🟠 Worker self-heal: `on_storage_lost` hook in `DictSyncEngine` → `reopen_after_storage_lost()`
  in `dict-instance.ts` — reopens the SAME OPFS file in place (dirty rows survive; unlike `reset()`
  no delete), capped at 3 attempts, then stops the engine for good. Ships `dict_connection_reopened`
  info row on success. Engine tests added. (Byte-identical harness files NOT touched — verified
  `instance.ts`/`db-client.ts` already diverge from house; identical set = transport, leader-election,
  opfs-connection, opfs-sah-vfs, db-capabilities, persistent-storage.)
- [x] ✅ 🟠 Dedupe `navigation` self-loops: `log_navigation` now skips `from === to` (event + breadcrumb).
  Root cause found: search-as-you-type `?q=` query-param navigations (same pathname). Test added.
- [x] ✅ 🟡 `Script error.`: added to `KNOWN_NOISE_PATTERNS` (masked, unactionable; rows keep shipping
  for breadcrumbs) + GIS script now loads with `crossorigin="anonymous"` (`load-script-once.ts`) so
  future GSI errors arrive unmasked. FA kit already had crossorigin.
- [x] ✅ 🟡 Worker log attribution: `session_id` threaded main-thread → `InstanceOptions` →
  `set_dict_log_session()`; all worker telemetry rows now carry `context.session_id`. New
  `get_session_id()` export in remote-log.
- [x] ✅ 🟡 `[google one-tap]` demoted console.error → console.warn (DEV-only, stops ~29 rows/day).
- [x] ✅ 🧹 Fixed stale `/api/admin/chat/*` comment in `20260702_initial.sql` → `/api/chat/*`.

## Phase 2 (user-approved): build the backlog dashboard items
- [x] ✅ 📊 **API-v1 activity panel** — new `ApiV1Activity` in `log-analytics.ts`
  (`build_api_v1_activity`: server `v1_*` rows grouped by day/event/dictionary/via + failure split,
  hot window) + "Agent API activity" panel on `/admin/analytics` (stat pair, daily area chart,
  by-operation + by-dictionary bars, auth-channel segmented bar). Stories + tests added; visually
  verified light + dark.
- [x] ✅ 📊 **Deploy-day errors fold** — `DailyPoint.stale_errors` (errors from a non-current
  `app_version`; 0 when current version unknown or on cold rollup days) + totals; Errors tile gains
  a "N from stale builds" hint and the Errors-per-day chart gains a "From stale builds" overlay
  line. Tests added.
- [x] ✅ 📊 **Top routes by distinct sessions** — `top_routes` rows now carry `sessions` (distinct
  per normalized route, aggregated in JS so `normalize_route` merges don't double-count); panel
  ranks + values by sessions with a raw-count fallback for archived-only windows. Test added
  (50-nav loop session no longer outranks 3 one-nav sessions).

## Verification
- `pnpm test` 175 files / 1189 tests pass · `tsc --noEmit` clean · `pnpm check` 0 errors ·
  eslint clean on touched files (page's 8 eqeqeq warnings pre-existing)
- svelte-look full-page screenshots of `/admin/analytics` Default story, light + dark — all
  three new features render correctly.

## Findings — the tuscarora "5-hour" scare (defused)
- The 112 `sync_failed` rows ran **20:12→21:32 UTC (80 min)**, retrying every **30s**
  (`DICT_SYNC_INTERVAL_MS`) — the earlier "16:35" bound in the report was the query window edge.
- The affected visitor was **anonymous and read-only**: zero `dict_changes_pushed` / `entry_created`
  on tuscarora in 48h → **no data at risk**. Their active browsing earlier (19:48 session) was
  healthy: page loads good, searches 12–14ms.
- **Zero heartbeats during the loop** → the tab was backgrounded/suspended; nobody was watching.
- Root cause: the **browser closed the held OPFS sync-access-handle** (tab suspension / system
  sleep) while the worker's 30s interval kept firing. No code path of ours closes the handle
  without stopping the engine first (verified reset()/shutdown() ordering).
- Fix = detect (`is_storage_lost_error`) → classify benign (warn, throttled) → **self-heal reopen**
  (same file, dirty rows preserved) with a 3-attempt budget + `dict_connection_reopened` marker.
