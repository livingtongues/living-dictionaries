# Port the house logging/analytics beef-up → living-dictionaries

Bring living's telemetry to parity with house (`~/code/house`). House is the reference
implementation — copy its files and adapt to living's conventions. Living's DB topology (OPFS
leader-worker) is **identical to house**, so this is a near-1:1 port (the easiest of the three).

> Branch: **`svelte-5-migration`** (living's active/deploy branch — do NOT use master).
> ⚠️ A concurrent agent has uncommitted work in `dict-client/` + `requests.ts`. The logging files
> below DON'T overlap, but check `git status` before committing and don't sweep their WIP blindly.

## Status
- ✅ **CF Phase 0 done**: "Add visitor location headers" Managed Transform ENABLED on
  `livingdictionaries.app` (zone `54b5f985b206fd11c9a53bbc59d0dc24`). It covers `new.livingdictionaries.app`
  too. Origin now receives `cf-ipcountry/cf-region-code/cf-ipcity/cf-iplatitude/cf-iplongitude`.
  (See house `.knowledge/integrations/cloudflare.md` for the mechanism + the Managed-Headers permission gotcha.)
- ✅ **Slice 1 — geo foundation + source (A + G-partial) DONE & verified** (28+9 tests, check 0 errors):
  migration `20260625_client_logs_source_geo.sql`; `shared.ts` columns; `geo-from-request.ts`;
  `geo/distance.ts`; `insert-client-log.ts` (geo+source); `/api/log/+server.ts` (geo + source +
  trusted-server); `log-server-event.ts`. Committed locally (NOT pushed — holding to avoid premature
  new.livingdictionaries.app deploy until the port is further along).
- ✅ **Slice 2 — retention + forever rollup (E) DONE & verified** (5 tests, check 0 errors):
  migration `20260625b_log_daily_metrics.sql`; `shared.ts` `log_daily_metrics` def; `log-archive-db.ts`
  (geo+source cols); `log-retention-cron.ts` (rollup_day w/ geo:<area>, archive, prune; living route
  buckets in `normalize_route`; self-gates IS_STANDBY + LOG_RETENTION_ENABLED); wired in `hooks.server.ts`.
  ⚠️ Needs `LOG_RETENTION_ENABLED=true` in living prod env (primary node) to actually run.
- ✅ **Slice 3+4 — client telemetry depth + capability + perf (C+D+B) DONE & verified** (37 telemetry
  tests, check 0 errors): `db-capabilities.ts` (dict-client/worker, copy-paste from house); `parse-user-agent.ts`;
  `log-events.ts` (living vocab); `remote-log.ts` replaced with house's rich version (session_id,
  breadcrumbs+click, track/track_timing/track_web_vital, heartbeat, noise filter, db-caps in session_start,
  livingdictionaries.app build_target); `remote-log.test.ts`; `perf.ts` (nav timing + web-vitals);
  `web-vitals` + `happy-dom` deps; `$api` alias added to vitest.config; wired init_web_vitals +
  report_initial_load + afterNavigate→log_navigation in `+layout.svelte`.
- ⏳ Remaining: F (dashboard: log-analytics + insights + /admin/analytics + port house `$lib/charts/*`).

## DEFERRED — nightly log-review horse-cron (Poly + Living)
Jacob: another agent is moving horse cron jobs into a `.cron/` folder per repo. AFTER that settles,
set up a **nightly log-review run** (the `log-and-fix` review) in BOTH Poly (tutor) and Living so an
agent scans `client_logs` each night. Do this LAST. (House already has its log-review flow.)

## What living already has (base error pipeline)
`remote-log.ts` (417 lines, older), `insert-client-log.ts` (has rate-limit; NO `source`/`geo`),
`/api/log/+server.ts`, `client_logs` table (server-only, in `shared.ts` + `shared-migrations/20260525_initial.sql`).

## Components to port (house ref paths → living)
Copy from `~/code/house/site/...`; rename rate-limit Symbol key `house:` → `living:` (already done in living's insert-client-log); keep snake_case; admin pages need NO i18n.

### A — Geo stamping (do FIRST; most self-contained)
- NEW migration `shared-migrations/20260626_client_logs_geo.sql` — `ALTER TABLE client_logs ADD COLUMN country/region/city TEXT, latitude/longitude REAL`. (NEW file, do NOT edit 20260525_initial — admin clients already applied it.)
- `schemas/shared.ts` client_logs: add the 5 geo columns (`real()` import).
- NEW `$lib/server/geo-from-request.ts` (copy verbatim — reads only `cf-*`; includes `geo_key`).
- NEW `$lib/geo/distance.ts` (haversine + buckets). ⚠️ **Living's origin is Hostinger Boston too**
  (same as house — verify in vps-setup) → keep `ORIGIN_BOSTON`. If living's VPS differs, update the constant.
- `$lib/server/insert-client-log.ts`: add `geo` param + columns (mirror house diff).
- `routes/api/log/+server.ts`: `geo_from_request(event.request)` once, pass to each insert. Also add
  `source` + trusted-server (G) here while editing.

### G — Server source + telemetry (fold in with A)
- NEW migration `..._client_logs_source.sql` OR include `source` in the geo migration (house split them; living can combine since pre-cutover). Add `source TEXT` column.
- `insert-client-log.ts`: add `source` param.
- NEW `$lib/server/log-server-event.ts` (copy).

### E — Retention + forever rollup
- NEW `log_daily_metrics` table migration (house `20260623b`).
- NEW `$lib/db/server/log-archive-db.ts` (CLIENT_LOG_COLUMNS incl. geo+source).
- NEW `$lib/db/server/log-retention-cron.ts` (rollup_day with geo:<area> metric, archive, prune).
  Wire start in `hooks.server.ts` behind `IS_STANDBY` guard + an enable env (living is blue/green too — confirm).

### D — Capability telemetry (1:1 — living = OPFS leader-worker like house)
- NEW `$lib/debug/parse-user-agent.ts` (copy).
- `db-capabilities`: house has `$lib/db/worker/db-capabilities.ts`; living's worker is `$lib/db/dict-client/worker/` — port `detect_db_capabilities`/`resolve_db_tier` there (the 4 harness files are already byte-identical across repos per house AGENTS, so this slots in).

### C — Client telemetry depth (remote-log beef-up)
- Reconcile living's `remote-log.ts` (417) with house's (608): add session_id, breadcrumbs + click
  capture, `track()`/`log_navigation`/`track_timing`/`track_web_vital`, heartbeat, visibility events,
  noise filter, `session_start` with db-capabilities, beacon flush. NEW `$lib/debug/log-events.ts` vocab.
  ⚠️ Diff carefully — don't regress living-specific bits already in its remote-log.

### B — Perf + Web Vitals
- NEW `$lib/debug/perf.ts` (report_initial_load + init_web_vitals). Add `web-vitals` to **dependencies**.
- Wire `report_initial_load_when_ready()` + `init_web_vitals()` in root `+layout.svelte onMount`.

### F — Analytics dashboard
- NEW `$lib/db/server/log-analytics.ts` (geo areas hot+cold merge + TTFB by country/distance).
- NEW `$lib/analytics/insights.ts`.
- NEW route `routes/admin/analytics/+page.server.ts` (gate by living `AdminLevel`, not house level-3) `+page.svelte` `_page.stories.ts`.
  Uses living's charts — house has `$lib/charts/*`; check if living has them, else port BarChart/ComboChart/LineChart too.

## Verify
`pnpm -C site test` (vitest), `pnpm -C site check`, `pnpm -C site lint`. Then post-deploy: query prod
`client_logs.{country,...}` populating (living origin behind CF) + `/admin/analytics` Geography panel.

## Open checks before coding
- [ ] Confirm living's origin location for the distance constant (Boston? vps-setup).
- [ ] Does living have `$lib/charts/*`? If not, port them from house for the dashboard.
- [ ] Living blue/green? (IS_STANDBY guard for the retention cron) — confirm in vps-setup.
- [ ] Living's cron-start hook location (it has `r2-snapshot-builder` — follow that pattern).
