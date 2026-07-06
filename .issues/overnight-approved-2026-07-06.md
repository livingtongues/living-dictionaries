# Overnight-approved log-and-fix work (2026-07-06)

Executing pre-approved items from the 2026-07-05 overnight brief. Leave ALL work UNCOMMITTED.

## Tasks
- [x] X1 — "Sync health / stuck client_behind" panel — backend builder `build_sync_health` + `SyncHealth` type + HealthView panel + mock + tests ✅
- [x] X3 — Archive retrofit hardened to ALL columns (was session_id only) + 2 tests ✅
- [x] X4 — Ported house's step() retention-sweep isolation + test ✅
- [x] PA2 — AUDIT found a REAL house-proven hazard: LD junctions (dict + shared.db dictionary_roles) all carry natural-key UNIQUE not covered by ON CONFLICT(id), + replace-all link/unlink, + upserts-before-deletes. Fixed BOTH engines (deletes-before-upserts) + real-SQLite regression test. ⚠️ touches live sync path — flag for review.
- [x] LD2 — Root-caused: star $effect depended on live `entry` object (re-emits every edit) → re-runs → `.rows` #track() spawns nested tracking effects → depth exceeded. Fixed: depend on stable `page.params.entryId`.
- [x] LD3 — Guarded satori() in /og with NotoSans-only fallback + og_font_unsupported warn ✅
- [x] LD5 — ALREADY IN CODE (f66b209c): second retry when snapshot_expired_recently, 300*(attempt+1) delay ✅
- [x] LD6 — Extended geo-split to LCP (lcp_by_country/lcp_by_distance) + HealthView tables + test ✅
- [x] LD7 — Deploy-settling fold in errors_by_version + retention-staleness warn styling ✅
- [x] BZ1 — port ALREADY IN CODE (b5bce3e8: bot-sessions.ts, wired into reader + rollup + CLI); wrote .knowledge/admin/analytics-telemetry.md (high-level shape only, per Jacob's note)
- [x] CARRY-THROUGH — verified both dead files gone; new-user-welcome.ts preserved ✅

## Notes
- All backend verified: 38 passing tests across log-analytics + log-retention-cron + og. tsc clean, lint 0 errors.
- HealthView visually verified via svelte-look (light + dark): Sync health panel, Deploy-settling stat, LCP geo tables all render.
- LD5 + BZ1 port were already implemented in prior commits — nothing to add beyond verification/knowledge.
