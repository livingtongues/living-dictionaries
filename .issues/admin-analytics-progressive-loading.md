# Admin /health + /analytics — faster, progressive top-down loading

Tracking the fleet-report item: LD's `/admin/health` + `/admin/analytics` are slow to load. Both
fetch the SAME `/api/admin/analytics` endpoint, which computes the ENTIRE `LogAnalytics` blob
(every panel for BOTH pages) in one synchronous better-sqlite3 blast, and the page renders nothing
until the whole payload resolves.

## Findings (profiled on local `.data`, ~16k rows, `ANALYTICS_PROFILE=1`)

Per-section timings (local; production's 14-day window is far heavier):
- Usage-only heavy: `build_api_v1` ~37ms, `build_missing_i18n` ~28ms, `build_top_dictionaries` ~3ms.
- Diagnostics-only heavy: `build_performance` ~52ms, `build_web_vitals` ~33ms, `build_geo_latency`
  ~34ms, plus errors_by_version / server_faults / leader / sync / build_adoption / storage /
  boot_health / uptime (each small).
- Shared core: `query_window_sessions`, `build_daily_series`, `build_usage_and_areas`,
  `build_capability`, geo areas — needed by both.

`/admin/analytics` renders ONLY usage panels; `/admin/health` renders ONLY diagnostics panels — yet
each computes + downloads the other's sections too.

## Coupling constraint

`area_counts` is threaded through `build_usage_and_areas` → mutated by `build_capability` → fed with
`build_geo_latency` into `build_geo_areas`. So `geo.areas` / `geo.located_sessions` / `capability`
must stay CORE (both pages). Only cleanly-independent heavy builders (they take just `ctx`) are gated.

## Design (implemented)

1. **Scope the compute** via a `scope` arg to `get_log_analytics` → `compute_log_analytics`:
   - `light` — core summary only (daily, deploys, totals, geo areas, capability, top_events/routes,
     by_source, event_coverage, error_clusters, pipeline). Skips ALL heavy builders.
   - `usage` — light + usage-heavy (api_v1, top_dictionaries, missing_i18n_keys).
   - `diagnostics` — light + diagnostics-heavy (performance, web_vitals, geo_latency,
     errors_by_version, server_faults, leader_health, sync_health, build_adoption, storage,
     boot_health, uptime).
   - `full` (default / omitted) — everything (back-compat; the log-review reader keeps full).
   - Skipped sections return typed EMPTY constants (shape-checked by tsc; mirror `empty_analytics`).
   - Cache key includes scope.

2. **Progressive top-down streaming** — each page load returns TWO streamed promises:
   - `primary` = `scope=light` (fast; the top summary + charts render immediately).
   - `secondary` = `scope=usage` (analytics) / `scope=diagnostics` (health) — the full page half.
   - The `+page.svelte` shows `primary` first, then SWAPS to `secondary` when it resolves (no fragile
     field-merge — both are complete `LogAnalytics` objects; `light` just has empties for the heavy
     fields, which render as their normal empty states until the swap). Views are UNCHANGED.
   - `light` cache entry is shared by both pages.

## Status
- [x] Port error-cluster enhancements (separate item, done)
- [x] `scope`-gated compute + empty defaults + cache key
- [x] Endpoint `?scope=` param
- [x] `_call` + both `+page.ts` (two streamed fetches) + both `+page.svelte` (primary→secondary swap)
- [x] Unit tests for scoped compute
- [x] tsc (clean) / eslint (clean on touched files) / svelte-check (0 errors) / vitest (touched suites green)
- [x] svelte-look screenshots — both pages render correctly (full mock, light+dark) AND degrade
      gracefully with heavy sections empty (the transient primary-tier state before the swap)

## Note
Full `vitest --run` shows ONE unrelated failure in `src/lib/server/chat/notification-messages.ts`
(passes in isolation; order-dependent). That file + the chat-digest/system-outbox WIP in the working
tree belong to a SEPARATE in-progress feature — not touched here.

## Verify
`ANALYTICS_PROFILE=1 pnpm exec vitest --run src/lib/db/server/_profile.test.ts` (scratch; delete after).
