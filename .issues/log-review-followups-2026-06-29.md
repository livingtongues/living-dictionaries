# Log-review follow-up batch (approved 2026-06-29)

Approved tasks handed off from the overnight `log-and-fix` brief (`.cron/log-reviews/2026-06-28.md`).
Per the command's "verify against current code before acting" rule, each was re-checked first.

## Verified ALREADY DONE (no code change — reported back)
- ✅ **L5 — `log_server_event` in `routes/api/*` failure paths.** Already present in every listed
  endpoint: `auth/email/send-code` (`auth_send_code_email_failed`), `auth/email/verify`
  (`auth_login_failed`), `dictionary/[id]/changes` (`dict_changes_failed` + `dict_changes_mirror_failed`),
  `upload` (`upload_presign_failed`), `messages/email-inbound` (`email_inbound_insert_failed`).
- ✅ **L4 — SSR dict-load failure logging.** `hooks.server.ts` `handleError` already logs ALL
  server-side load throws via `log_server_event` (route + path + status + crash/warn/info level). The
  `[dictionaryId]/+layout.ts` catch also keeps a patched `console.error` for the client-nav case.
  **The literal ask (import `log_server_event` into the universal `+layout.ts`) is INFEASIBLE** —
  `$lib/server/*` cannot be imported into a universal load (build error / client-bundle leak — the
  exact bug class that catch was added to surface). The only residual is the deep original stack on
  first SSR paint (handleError sees the HttpError shell); not worth breaking the boundary for. Left
  as-is.

## DONE (all verified: `pnpm check` 0 errors, 166 tests green, story screenshotted)
- [x] **M1** — `webdriver` stamped per-row in `enrich()`; `log-analytics` audience filter +
  per-session bot check fold in `coalesce(json_extract(context,'$.webdriver'),0)=1`. Test added.
  ↳ **Cross-repo TODO: port the same `navigator.webdriver` capture + bot-filter fold to tutor** (and
  house if it gains e2e) — they share the analytics architecture and have the same headed-automation
  blind spot.
- [x] **M2** — `$lib/debug/classify-error.ts` created (`KNOWN_NOISE_PATTERNS`, `is_known_noise`,
  `http_status_to_log_level`, `is_expected_error_response` + tests). `+error.svelte` uses
  `http_status_to_log_level`; `log-analytics` `is_noise = is_known_noise || is_expected_error_response`.
- [x] **L6** — `Map.svelte` shows a graceful "WebGL unavailable" fallback (i18n `map.webgl_unavailable`)
  instead of an infinite pulse; the log is demoted to `warn` + folded into `KNOWN_NOISE_PATTERNS`.
- [x] **L2** — `performance.by_route` (page_load grouped by normalized route, slowest p95 first) +
  a "Page load by route" table on `/admin/analytics`. Test + story data added; screenshotted.
- [x] **N3** — 7 independent section builders extracted (`build_error_clusters`, `build_performance`,
  `build_web_vitals`, `build_ttfb_latency`, `build_errors_by_version`, `build_deploys`,
  `build_pipeline_health`, `build_leader_health`). SQL/behavior identical (16 analytics tests green).
  **Deferred (coupled core):** the daily/events/routes/source/geo-area machinery shares mutable
  `area_counts` across the rollup + session loops — left in the orchestrator; split it in a dedicated
  pass where the interdependency can be threaded carefully.

## (original TO BUILD list — superseded by DONE above)
- [ ] **M1 — `navigator.webdriver` capture + bot filter.** Stamp `webdriver: true` into every row's
  `context` in `remote-log.ts` `enrich()` (only when true, to keep context lean). Fold into
  `log-analytics.ts` audience filter (`is_bot_ua=1 OR context.webdriver=1`) — per-row (filter) +
  per-session (`MAX` in the session loop for capability/geo). Cross-repo: also flag tutor.
- [ ] **M2 — `$lib/debug/classify-error.ts`.** Centralize error classification; route ingestion +
  analytics through it. Exports: `KNOWN_NOISE_PATTERNS` + `is_known_noise` (moved from log-analytics),
  `http_status_to_log_level` (extracted from `+error.svelte`), `is_expected_error_response` (ported
  from house). `+error.svelte` → use `http_status_to_log_level`. `log-analytics.ts` → import
  `is_known_noise` + `is_expected_error_response`; `is_noise = is_known_noise || is_expected_error_response`.
- [ ] **L6 — graceful no-WebGL globe fallback + noise filter.** `Map.svelte` already catches the
  synchronous WebGL throw + logs one clean message. Remaining: (a) show a real fallback message in the
  placeholder instead of the infinite pulse; (b) demote the log to `warn` + add the WebGL message to
  `KNOWN_NOISE_PATTERNS` so it's filtered as noise.
- [ ] **L2 — per-route p95 perf panel.** Group `page_load` perf timings by `url_route(url)` →
  per-route p50/p95/count; render a panel on `/admin/analytics`. (House proposed but hasn't built it;
  this is the LD build.)
- [ ] **N3 — split `get_log_analytics` into named same-file section builders** (`build_daily`,
  `build_error_clusters`, `build_performance`, `build_pipeline_health`, …). Pure extraction — keep SQL
  + call-count identical, targeted tests green. Do LAST, after the feature edits settle.

## SKIP
- L3 (error-per-use by feature) — deferred per brief.

## Verification
- `pnpm vitest run` (targeted), `pnpm check`, `pnpm lint`. Baseline before work: 32 tests green.
- Visual: svelte-look story for the analytics page / Map fallback where practical.
