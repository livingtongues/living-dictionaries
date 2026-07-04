# /admin/analytics — dashboard improvement backlog

Deduped backlog of proposals from the `log-and-fix` daily review (Phase C). Reader:
`src/lib/db/server/log-analytics.ts`; page: `src/routes/admin/analytics/+page.svelte`; chart lib:
`$lib/charts/` (Bar/Combo/Line).

## Shipped (2026-06-26, `.issues/logging-buildout.md`)
- ✅ **Pipeline-health / ingestion-liveness strip** — last log / session_start / server log /
  retention + hot/archived counts; live vs "no ingestion in 24h" verdict.
- ✅ **Self-instrumentation event-coverage panel** — declared `ALL_TRACKED_EVENTS` vs seen/never.
- ✅ **Geo-transform health hint** — "CF location-headers transform appears OFF" when located but no coords.
- ✅ **Errors by build version** (current vs stale bundle) — ported from house.
- ✅ **Leader-worker DB health panel** — `live_query_*` timeouts/recovered/failed + had_leader/source split.

## Shipped (2026-06-27, `.issues/log-review-fixes-2026-06-26.md`)
- ✅ **Bot/headless exclusion across ALL usage+engagement+geo** — registered `is_bot_ua` SQLite fn +
  `HUMAN_ROWS_SQL` on daily/events/routes/source/users/perf/ttfb/web_vitals; bot-skip-first in the
  session loop (geo areas); cold rollup (`log-retention-cron.ts`) skips bot rows too for hot/cold
  consistency. Server rows (NULL UA) always kept; capability panel keeps its separate `bot_sessions`.
- ✅ **Core Web Vitals panel + reader agg** — `web_vitals` (p50/p75/p95 by LCP/INP/CLS/FCP/TTFB,
  human-only), p75 graded vs CWV thresholds, with a "no vitals despite N human sessions /
  headless-only" empty-state hint.

## Shipped (2026-06-28, `.issues/log-review-recommendations-2026-06-27.md`)
- ✅ **Deploy/version annotation markers on the daily timeline** — `log-analytics.ts` `deploys`
  (first-seen day per `app_version`, hot window, human rows); page maps to chart `events` (chip
  `⬆ HH:MM` + note with version/first-seen/sessions) on the Traffic ComboChart + Errors LineChart.
- ✅ **`page_load` percentile hygiene** — perf query filters `duration_ms > 0` (drops bfcache/instant
  0ms loads); `PerfSummary.slowest = { duration_ms, route }` (new `url_route` helper, inline-tested);
  perf panel shows a "slowest Ns · /route" row per metric.

## Shipped (2026-06-29, `.issues/log-review-followups-2026-06-29.md`)
- ✅ **`navigator.webdriver`-based automation exclusion (M1)** — `remote-log.ts` `enrich()` stamps
  `context.webdriver:true` on every row of an automated session; `log-analytics.ts` folds
  `coalesce(json_extract(context,'$.webdriver'),0)=1` into the audience filter (per-row) + the
  per-session bot check (capability/geo). Headed Playwright/Selenium now lands in Bots regardless of
  UA. **Cross-repo TODO: port to tutor.**
- ✅ **Per-route p95 performance (L2)** — `performance.by_route` groups page_load timings by
  normalized route (slowest p95 first); "Page load by route" table on the Performance panel.
- ✅ **`classify-error.ts` consolidation (M2)** — shared error-classification module; ingestion
  (`+error.svelte`) + analytics (`is_noise`) both route through it.
- ✅ **No-WebGL globe fallback + noise filter (L6)** — graceful fallback message + `warn`-level log
  folded into `KNOWN_NOISE_PATTERNS`.

## Open proposals
- **★ Geo-split Core Web Vitals (TTFB/LCP by region or distance-to-origin bucket)** *(filed 2026-06-30 —
  grounded in a real geo tax).* The shipped CWV panel aggregates p50/p75/p95 per metric across **all**
  geos, hiding that on 06-30 **64/65 sessions were Malaysia → Boston origin**, paying ~997ms page-load
  TTFB (vs 563ms US) and dragging LCP to ~2.8s (needs-improvement). Add a TTFB/LCP breakdown by
  `country`/`region` (or near/mid/far distance-to-Boston buckets, reusing the existing haversine),
  human-only, so the far-region tax is a standing signal instead of a hand-run query. LD-first; flag for
  house (also Boston-hosted).
- ✅ **Deploy-day errors fold** *(ported from house · 2026-06-30; SHIPPED 2026-07-03).*
  `DailyPoint.stale_errors` counts error rows from a non-current `app_version` (0 when the current
  version is unknown / on cold rollup days); Errors tile shows a "N from stale builds" hint and the
  Errors-per-day chart gains a "From stale builds" overlay line — a deploy-day spike now auto-explains
  as churn. Grounded in 07-03: 285 errors, ~0 live regression.
- ✅ **★ Rank "Top routes" by distinct sessions** *(filed + SHIPPED 2026-07-03).* `top_routes` rows carry
  `sessions` (distinct per normalized route, JS-aggregated so `normalize_route` merges don't
  double-count); the panel ranks + values by sessions, falling back to raw counts for archived-only
  windows. Paired with the source-side fix: `log_navigation` now skips `from === to` self-navs
  (the 1,869-nav search-as-you-type loop).
- ✅ **★ API-v1 activity panel** *(filed 2026-07-01; SHIPPED 2026-07-03 — "Agent API activity" panel:
  `build_api_v1_activity` groups server `v1_*` rows by day/event/dictionary/via with a failure split,
  hot window; stat pair + daily area chart + by-operation/by-dictionary bars + auth-channel bar).* The
  server-emitted `v1_*` events (`v1_media_attached`, `v1_entry_updated/deleted`, `v1_entries_written`,
  `v1_sentence_updated`, `v1_media_deleted`, `v1_feedback_received`) are the **single largest volume +
  richest activity signal** right now — on 07-01, 2,089 of 2,729 rows were server rows, ~3,500 v1 rows
  in 7d from one contributor's `api_key` pass on `river` (1,780 media attach + 856 del + 853 upd) — yet
  they're **invisible on the dashboard** (not in `ALL_TRACKED_EVENTS`; untouched by `log-analytics.ts`).
  Had to hand-count "who edited what via the API." Build a panel grouping `v1_*` by **type**
  (attach/update/delete/write), **dictionary** (`context.dictionary_id`), and **channel**
  (`context.via`), with error-vs-success + a per-day trend. Directly serves the **human/agent
  editing-parity** direction (AGENTS.md) — makes agent edits as legible as human ones. Precursor: add
  the stable `v1_*` names to a server-event vocab so the coverage panel can track them.
- **Capability/frequency-based de-bot (not UA-based)** *(ported from house · 2026-07-01 — LOW until
  crawler traffic lands).* house (Nth confirmation on 07-01) sees a plausible-Chrome crawler
  `is_bot_user_agent` can't catch, spawning thousands of single-hit sessions that inflate the human
  `sessions` line; their fix excludes sessions that **never heartbeat / never reach wa-sqlite
  capability** + a "one UA with N× single-hit sessions" heuristic, then layers a cookieless
  `visitor_hash` (already on LD's backlog below). **house explicitly flagged this for LD** (also
  Boston/Cloudflare). LD isn't crawler-inflated yet (traffic is one real contributor + Jacob), so LOW —
  but the right defensive port; pairs with the `visitor_hash` item.
- **★ Schema-drift guard on the pipeline-health strip** *(filed 2026-06-29 — NEXT-TO-BUILD, grounded
  in a real P1).* Today's review caught a live `crash`: `/api/admin-sync` 500'd with `no such table:
  dictionary_partners` because the prod `shared.db` never got that table (the initial migration was
  consolidated *after* it was applied → see `.issues/missing-dictionary-partners-table-prod.md`). The
  dashboard would have pre-empted it: in `log-analytics.ts`, intersect `SELECT name FROM sqlite_master`
  with `SYNCABLE_TABLE_NAMES` and render any missing table in red on the health strip ("⚠ schema drift:
  `<table>` missing"). Cheap, and turns a user-hit 500 into a proactive ops signal. Extend to per-dict
  DBs once that's wired.
- **Leader-worker failures by SQLite result `code` + current-vs-stale build** *(ported from house,
  2026-06-29).* LD's leader-worker health panel (shipped 06-26) shows only timeout/recovered/failed +
  had_leader/source. Add a `code` histogram (label SQLite codes — 11=CORRUPT, 26=NOTADB…) and an
  `app_version` current-vs-stale split on the *failed* bucket, to distinguish "corruption on a stale
  build (self-heals on update)" from "RPC timeouts on the current build (a real regression)". Data is
  already in `context.code` + `app_version`.
- **Intent→shown success event** *(ported from house/tutor, 2026-06-29 — LOW until reader traffic).*
  Pair each open-intent event (`entry_opened` / `dictionary_opened`) with a "rendered" success event so
  analytics can measure the intent→shown gap and rank silently-degraded reads (live-query failures that
  open but never populate). Fits LD's event vocab; revisit when real contributor/visitor traffic lands.
- **Error-per-use by feature** *(ported from house, 2026-06-28 — LOW until real traffic)* — errors
  normalized by the matching usage event, to rank what's breaking relative to how much it's used.
- **Real session-duration distribution** (median/p90 from heartbeat span) + **events/session**,
  augmenting/replacing the proxy "Logs / session" engagement metric (had to compute the
  2198s-vs-~10s spread by hand in the 06-26 review). **Sharpened 2026-06-29:** make it
  **visibility-aware** — a single idle tab today emitted ~1,200 heartbeats over 11 h and would read as
  668 min of "engagement". Either gate heartbeats on `document.visibilityState` in `remote-log.ts`, or
  compute duration as the **active (visible) span** only.
- **True unique-visitor counts via a cookieless `visitor_hash`** (lifted from the retired
  `analytics-pipeline.md` — the one idea the house-port analytics didn't carry over). The shipped
  dashboard counts **sessions** (`session_id`), not long-lived visitors. To add real uniques:
  server-stamp `visitor_hash = sha256(cf-connecting-ip + '|' + user_agent + '|' + ANALYTICS_SALT)` at
  ingest in `insert-client-log.ts` (new nullable column + index), roll it up in
  `log-retention-cron.ts`. Decisions already made with Jacob: **per-app `ANALYTICS_SALT`** (hashes
  non-correlatable across LD/tutor/house), **NOT daily-rotated** (a visitor stays one id across days),
  **GDPR explicitly a non-concern** (no cookie/consent banner). Accepted tradeoffs: phone+laptop = 2
  visitors; NAT + same UA can collide. Good enough for traffic stats.
- ✅ **Split real vs noise in the daily-error series** *(filed + SHIPPED 2026-07-02 — grounded in a
  live false spike).* On 07-02 one contributor caught two back-to-back deploys and logged **99
  stale-chunk `Failed to fetch dynamically imported module`** rows (`KNOWN_NOISE_PATTERNS`) + 8 real,
  so the day would have rendered **~107** and looked like a regression. **Shipped:** registered an
  `is_noise_msg(message)` SQLite fn (mirrors `is_bot_ua`) reusing `is_known_noise ||
  is_expected_error_response`; `DailyPoint`/`totals` gained `real_errors` (live query folds noise;
  cold rollup days fall back to raw `errors`); the errors line + "Errors" tile + `error_rate` insight
  now show **real faults** with a "+N noise" annotation and a "N known-noise rows excluded" subtitle.
  The **LD instance of the cross-repo "noise vs real" theme** (tutor filed the same 07-01; house
  shipped it). Pairs with the shipped Phase-B classify fix for edge-5xx interstitials (deploy-swap
  520s → `network`/`warn`) so they never inflate the real count either.
- **Server faults / schema-drift strip** *(ported from house · 2026-07-02 — house explicitly flagged
  for LD).* Isolate `source='server' AND level IN ('error','crash')` clustered by `context.route`,
  newest-first with count + last-seen, and highlight `SqliteError`/`no such table`/`no such column`
  as the schema-drift class — a "these are always real, fix now" board separate from the mixed client
  stream. Grounded in LD's own history (the `dictionary_partners` schema-drift 500) and today's
  deploy-swap `Internal Error` 500s, which sat undifferentiated among client noise. `log-analytics.ts`
  already reads `source`; overlaps the existing **schema-drift guard on the health strip** item above
  (build them together). LD-fit confirmed; also on tutor's radar.

## Cross-pollination from sibling apps (house + tutor)
*Added 2026-06-27 (Phase D — first cross-repo read). LD is currently the furthest-along dashboard, so
the borrow list is short.*

- ✅ **Error-cluster + known-noise classification on the errors panel** *(ported from tutor — SHIPPED
  2026-06-27, commit b10f813e)* — `error_clusters` now groups by `message` + `substr(stack,1,200)`
  with n/users/first/last and tags `KNOWN_NOISE_PATTERNS` (`Network error for /api/log`, `Failed to
  fetch dynamically imported module`) via `is_noise`, excluded from the headline error count.
- **Error-audience real-user verdict card** *(ported from house — LOW for LD)* — house's
  `error_audience` shows a `real_user / anonymous / bot` split + a "0 real-user errors → all noise"
  verdict. LD's shipped `error_clusters` + `is_noise` + human-only usage already cover most of the
  intent; keep as low-priority.
- **"Expected response (401/403/404)" bucket** *(ported from house, filed 2026-06-27 — MOSTLY COVERED
  on LD)* — house adds an `expected` bucket to `error_audience` so prefetch/permission gates aren't
  counted as real-user errors. **LD already handles this at the source:** `+error.svelte` demotes
  401/403→warn and 404→info, so expected gates never reach the `error/crash` levels feeding
  `error_clusters`. Only revisit if LD later builds an `error_audience` panel.

*LD wins the siblings should borrow (flag in their reviews):* the **bot/headless exclusion across all
usage+geo metrics** (house only de-bots errors so far; tutor not at all), the **Core Web Vitals**
panel, and the **pipeline-liveness + event-coverage** strips.

*Skipped as inapplicable to LD:* tutor's **Mobile-health / memory-OOM** RN panel (web-only) and
house's **/admin/revenue** dashboard (no payments).

## Sourced from
- `.cron/log-reviews/2026-06-25.md` (first run / zero-data baseline)
- `.cron/log-reviews/2026-06-26.md` (first real-data run; ~91% synthetic/headless)
- `.cron/log-reviews/2026-06-27.md` (idle day; deploy-markers + page_load-hygiene proposals; tutor
  error-cluster borrow shipped)
- `.cron/log-reviews/2026-06-28.md` (fully idle; deploy-markers + page_load-hygiene ships verified;
  `navigator.webdriver` automation-exclusion finding; house per-route-p95 + error-per-use borrows)
- `.cron/log-reviews/2026-06-29.md` (FIRST real-traffic day; caught the `dictionary_partners` P1
  schema-drift crash; schema-drift-guard + visibility-aware-duration + house leader-health-code borrows)
- `.cron/log-reviews/2026-06-30.md` (sustained real-contributor traffic from Malaysia; geo-split-CWV
  proposal from the far-region TTFB tax; house deploy-day-errors-fold borrow; gloss_languages homepage
  guard + `aborted` noise-fold action items)
- Phase D cross-repo read 2026-06-27 (house `error_audience`/`errors_by_version`/expected-bucket;
  tutor `error_clusters`/`KNOWN_NOISE`).
