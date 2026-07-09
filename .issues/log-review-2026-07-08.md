# Log Review 2026-07-08 (working notes)

Read-only investigation → report at `.cron/log-reviews/2026-07-08.md`. No code edits.

## Phase A findings (raw)
- 24h: 2377 sessions, 45 users, 37930 events. 7d: 5867 sess / 82 users. 30d: 5953 / 82.
- Top error clusters (24h):
  - sync_failed n=1271, 4 users, **3 sessions** (retry loop in few sessions)
  - effect_update_depth_exceeded n=188 (+36 firefox) — 4 users, 186+36 sessions — WIDESPREAD ⚠️
  - each_key_duplicate n=107 (+13+10+4) — Svelte dup key
  - getBoundingClientRect null n=97, 1 user 1 session (localized)
  - {"isTrusted":true} n=54 — media error event noise
  - Internal Error n=50, 50 sessions
  - live_query_failed n=37, 2 users 6 sessions
  - RangeError Max call stack (multiple) — likely tied to effect loop / each_key
  - leader_boot_failed n=21, 2 sessions
  - ServiceWorker "Rejected" (wrsParams.serviceWorkers.*) — BOT/scanner noise, user=0
  - initial dict sync failed n=18; Failed to read dict bundle from wa-sqlite n=8
  - vernacularName SSR error n=2; Can't load image lh3 fetch failed (OG SSR) n=1 each

## TODO
- [x] Drill effect_update_depth + app_version timing + git log → ✅ FIXED in current build (10154e30). 0 on 1783505001025.
- [x] Drill each_key_duplicate → ✅ FIXED (4b63fd30/17101eb4 + 10154e30). 0 on current build.
- [x] Drill sync_failed / live_query_failed / leader_boot_failed → stale clients on 07-03 builds (marlene 3531, greg 1620). Un-fixable until reload.
- [x] Admin per-user narrative → Jacob (testing), Diego (editing), Greg (stuck stale tab). Anna inactive.
- [x] Perf + geo + capability → CWV p75 healthy (LCP 2428 borderline, INP 136 good); opfs 85%.
- [x] Health/housekeeping → 215k rows, oldest 06-26 (within 14d), retention ran 10:06 ✅, logs.db 467MB (+110MB/day, watch).
- [x] Phase B coverage gaps → /og no try/catch, isTrusted Event extraction, Internal-Error reason, vernacularName guard.
- [x] Phase C dashboard proposal → build-adoption/stale-client-population strip (verified NOT present; appended to backlog).
- [x] Phase D sibling cross-pollinate → ported house's sync-cause-naming + RED verdict; reaffirmed per-session loop-flag; flagged LD viewership rollup to siblings.

## DONE — report written to `.cron/log-reviews/2026-07-08.md`; backlog updated with 2 new proposals.

### Follow-up code-audit (not a dashboard panel) — do when actioned
- Audit `site/src/lib/db/sync/sync-failure-classify.ts` + retry path: a `dictionary not found` 404
  (e.g. `zapoteco-de-analco`) is FATAL — confirm it stops, not retries forever like a transient.
  (LD flag-back returned via house 07-07.)
- Investigate why service worker isn't updating stale tabs (`ServiceWorker … unknown error`/`Timed out`);
  consider forcing a hard reload after N persistent `schema_outdated` blocks in `decide_client_behind_recovery`.
