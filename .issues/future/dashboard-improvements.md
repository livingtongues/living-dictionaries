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

## Open proposals
- **Real session-duration distribution** (median/p90 from heartbeat span) + **events/session**,
  augmenting/replacing the proxy "Logs / session" engagement metric (had to compute the
  2198s-vs-~10s spread by hand in the 06-26 review).
- **True unique-visitor counts via a cookieless `visitor_hash`** (lifted from the retired
  `analytics-pipeline.md` — the one idea the house-port analytics didn't carry over). The shipped
  dashboard counts **sessions** (`session_id`), not long-lived visitors. To add real uniques:
  server-stamp `visitor_hash = sha256(cf-connecting-ip + '|' + user_agent + '|' + ANALYTICS_SALT)` at
  ingest in `insert-client-log.ts` (new nullable column + index), roll it up in
  `log-retention-cron.ts`. Decisions already made with Jacob: **per-app `ANALYTICS_SALT`** (hashes
  non-correlatable across LD/tutor/house), **NOT daily-rotated** (a visitor stays one id across days),
  **GDPR explicitly a non-concern** (no cookie/consent banner). Accepted tradeoffs: phone+laptop = 2
  visitors; NAT + same UA can collide. Good enough for traffic stats.

## Sourced from
- `.cron/log-reviews/2026-06-25.md` (first run / zero-data baseline)
- `.cron/log-reviews/2026-06-26.md` (first real-data run; ~91% synthetic/headless)
