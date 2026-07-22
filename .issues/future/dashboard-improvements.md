# /admin/analytics — dashboard improvement backlog

Deduped backlog of proposals from the `log-and-fix` daily review (Phase C). Reader:
`src/lib/db/server/log-analytics.ts`; page: `src/routes/admin/analytics/+page.svelte`; chart lib:
`$lib/charts/` (Bar/Combo/Line).

**STANDING DESIGN DIRECTIVE (Jacob, 2026-07-10):** steer both dashboards AWAY from error lists and
analytics jargon, TOWARD plain language + at-a-glance visuals. Prioritize: user numbers, user
experience, where the site is being used well, where the pain points are, concrete action steps,
and what to be aware of. New panels should read as sentences/verdicts first, tables second (see
`$lib/analytics/at-a-glance.ts` + `AtAGlance.svelte` for the shipped pattern). Weigh future Phase C
proposals against this lens.

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

## Shipped (2026-07-07, `.issues/dictionary-viewership-and-nav-speed-telemetry.md`)
- ✅ **Per-dictionary viewership forever rollup + "Top dictionaries by viewers" panel** — new
  `dictionary_daily_views(day, dictionary_id, sessions, anon_sessions)` in shared.db (server-only,
  never pruned), filled by `rollup_day()` from `dictionary_opened` (bots excluded, anon = no user_id).
  `build_top_dictionaries` merges the cold rollup + live tail, joins the catalog for names/urls; panel
  on `/admin/analytics` (usage) shows 30d/7d/today views + anon share per dict, most-viewed first.
  Seeds a future public "visits/month" badge (see `.issues/future/dictionary-public-visits-stat.md`).
  Records the "visits ≠ visitors" caveat (session resets per load; true uniques need `visitor_hash`).
- ✅ **Client SPA navigation timing surfaced** — `build_performance` now folds the already-logged
  `navigation.duration_ms` (home→entry etc) into a first-class `navigation` perf metric + a
  by-destination-route split. NO new logging. Answers "how fast is home→entry."
- ✅ **LCP-by-landing-route** — `web_vital` LCP rows grouped by route (distinct from the still-open
  geo-split-LCP item below, which is by country/distance).
- ✅ **"Speed at a glance" strip on `/admin/health`** — friendly top-of-page cards: page-load p50/p95,
  in-app navigation p50/p95 (+ 30d p50 micro-sparklines), LCP p75. Plus nav trend chart + nav/LCP
  by-route tables in the Performance panel.

## Shipped (2026-07-09, `.issues/log-review-2026-07-08-actions.md`)
- ✅ **Build adoption / stale-client population strip** — `build_build_adoption` (last-24h
  `session_start` GROUP BY `app_version`, build epoch → current / <3d behind / ≥3d stale / unknown)
  with the "N% of active sessions can't receive fixes" headline + per-build named signed-in users;
  panel on `/admin/health` above Sync health.
- ✅ **Storage & WAL health strip** — `build_storage` (statSync on shared.db / logs.db /
  logs-archive.db + `dictionaries/*.db` aggregate, `wal_ratio` red > 2×); panel on `/admin/health`.
- ✅ **`sync_failed` 404 cause named** — new `not_found` classifier kind (error-level, non-transient →
  repeat-breaker halts after 3), so the Sync-Health by-kind table names the fatal class instead of `other`.

## Shipped (2026-07-10, `.issues/log-review-2026-07-10-actions.md`)
- ✅ **Dictionary-boot cold/warm perf panel + `dict_boot` emitter** — `dict-instance.ts` now emits a
  worker-safe `dict_boot` perf row on boot completion (cold/warm + `storage` + `snapshot_bytes` +
  per-stage `stage_ms`; `report_dict_boot` in `report-dict-sync-failure.ts`); `build_dict_boot`
  (`DictBootPerf`: cold/warm p50/p90/p95, typical snapshot size, slowest-first by-dictionary with
  catalog names, daily trend) + the "Opening a dictionary" panel on `/admin/health` with a
  "collecting since this deploy" empty state. E2E-verified cold (497ms, snapshot 1.5MB) + warm
  (270ms) rows in dev. `dict_boot` also joined `PERF_METRICS` so it rides the shared perf summary.
- ✅ **Nav from-section split (the interim)** — `performance.nav_sections` classifies every SPA hop
  as `entering_dictionary` (cold first hop) / `within_dictionary` (warm) / `other`; table in the
  Performance panel + a split line on the Speed-at-a-glance nav card.
- ✅ **Low-sample "thin data" guard** — `THIN_SAMPLE_N = 15` + `is_thin_sample` in
  `dashboard-format.ts`; perf summary cards, speed cards, all route/nav/LCP/dict-boot tables dim +
  asterisk thin rows with a shared footnote. *(ported from tutor)*
- ✅ **"At a glance" plain-language story strip** — `$lib/analytics/at-a-glance.ts` (`build_glance`,
  tested) + `AtAGlance.svelte`, rendered at the top of BOTH `/admin/analytics` and `/admin/health`
  (humans audience): People (count + WoW trend + sparkline), Experience (verdict sentence + the
  cold-boot pain point), Where (top dictionaries + areas), and a tone-colored "For you" action list
  derived from schema-drift / server-faults / sync-storm / boot-health / stale-build signals. The
  first concrete instance of the plain-language directive above.

## Open proposals
- ✅ **SHIPPED 2026-07-22 (`d6871c60`) — Fold cross-browser stale-bundle transients into
  `KNOWN_NOISE_PATTERNS`.** `classify-error.ts:24-26` now folds all three engines' wording:
  `Failed to fetch dynamically imported module` (Chrome) + **`Importing a module script failed.`**
  (Safari/Firefox) + **`Unable to preload CSS`** (Vite `preloadError`). Don't re-raise.
- ✅ **SHIPPED 2026-07-22 (`d6871c60`) — Fold the null-session zombie `sync_failed`/`leader_boot_failed`
  storm out of the `real_errors` headline.** `log-analytics.ts:1218` rollup now carries
  `AND NOT (session_id IS NULL AND message IN ('sync_failed','leader_boot_failed'))`. The de-noised trend
  confirms the payoff — genuine errors ~30-50/day vs the old ~1,600-2,000/day raw headline. Don't re-raise.
- **★ NEW — Persist `/admin/analytics` compute cost as a trend** *(ported from tutor 07-15 green-night
  sweep · filed 2026-07-16 — LD has the identical ephemeral pattern; verified NOT present).* LD's
  `log-analytics.ts:750` `timed()` logs `console.log('[profile] <label>: <ms>ms')` into throwaway
  `docker logs`, so the standing "is the dashboard getting slower?" watch has no persisted trend to read
  (identical to what tutor flagged on poly). Emit **one** `log_server_event({ level:'info', message:
  'admin_analytics_computed', context:{ scope, days, audience, total_ms, cache_hit:false } })` per
  *uncached* whole-window compute (skip cache hits → ~a handful/day, admin-only). Then the daily log
  review can trend dashboard build-cost week-over-week and catch a slow regression weeks early — exactly
  what the standing load-perf watch is for. Observability, LOW.
- ~~**★ Sync-Health: surface the `sync_halted_repeated_failure` terminal wedge**~~ **DROPPED
  (Jacob, 07-14 ruling):** "wedges are your job to find and fix, not mine to watch in a dashboard —
  surface as actionable digest items, not a panel." No wedged-client dashboard panels. `sync_halted_*`
  rows are surfaced as nightly-digest items instead (07-15: the day's 2 halts were bot/worker, no real
  wedge). Removed from the backlog per the standing "no wedged-client panels" decision.
- **Small — "current-build clean?" verdict badge on `/admin/health`** *(ported from tutor 07-13 · filed
  2026-07-14 · LOW).* tutor's top Phase-C item: a one-line "Current build `<id>`: ✓ clean / ⚠ N errors"
  derived from the `errors_by_version` `is_current` row LD already computes. LD renders the current-vs-
  stale split but leaves the current-build verdict to inference. One-line, data present. Low priority
  while error volume is calm.
- **★ NEW — Dict-boot cold-tail vs snapshot-size correlation on the "Opening a dictionary" panel**
  *(filed 2026-07-10 run 2 — grounded in the FIRST day of live `dict_boot` data; verified NOT present).*
  The just-shipped `build_dict_boot` (`log-analytics.ts` ~line 1670) reports cold/warm p50/p90/p95 +
  a single `cold_snapshot_bytes_p50`, but does NOT correlate boot duration against snapshot size — so
  the human cold **p95 of 11.6 s** (measured 07-10: cold n=92 p50 1,936 ms / p90 7,298 ms / p95
  11,650 ms; warm n=100 p50 133 ms) can't be attributed to *download-bound* (a big-dictionary snapshot
  over a slow link) vs *device-bound* (OPFS write / migrate on a weak phone). `snapshot_bytes` and
  per-stage `stage_ms` are ALREADY captured on every cold row, so this is presentation-only: add a small
  scatter or a two-bucket split (e.g. boot p50 for snapshots <2 MB vs ≥2 MB) + a `snapshot_fetch` vs
  `opfs_open`+`migrate` stage-time breakdown for cold boots. Answers "is the cold tail the snapshot
  download or the device?" — the exact next question the new panel raises. *(LD-original; broadcast to
  siblings once shaped — house/tutor have no equivalent local-DB-boot panel yet.)*
  **UPDATE 2026-07-11 (ported from house 07-10):** add a *time-series* dimension too — a **daily cold-boot
  p50/p95 trend chart + sample count**, not just the within-window size split. house's 07-10 Phase C
  proposes exactly this for its analogous `viewer_cold_download` metric and explicitly flags LD's
  dictionary snapshot-boot path as the place to mirror it; the daily curve makes an R2/snapshot
  regression legible over days rather than only in the current window.
- ✅ **SHIPPED 2026-07-14 — Bot/crawler share % on each error cluster.** Ported tutor's
  `build_error_clusters` implementation: `ErrorCluster` now carries `sessions`, `max_per_session`,
  `bot_sessions`, and `bot_pct` (UA `is_bot_user_agent` ∪ webdriver ∪ frequency-bot); `bot_pct > 90`
  is the "mostly crawler" signal. Same GROUP BY + a per-(cluster,session) breadth pass. See
  `log-analytics.ts` `build_error_clusters` + its test. *(Original entry below.)*
- **★★ NEW — Bot/crawler share % on each error cluster** *(filed 2026-07-09 — grounded in TODAY's
  SEO-crawl flood; also ported from tutor 07-08 Phase C).* `ErrorCluster` (`log-analytics.ts` ~line
  234) keeps ALL rows on purpose ("a bot hitting a real error is a real signal") but exposes **no
  bot share**, so a crawler storm ranks as a P1 until a hand UA query. Today: `live_query_failed`
  1,378 rows / 294 sessions looked catastrophic — **1,358 / 1,378 = 98.5% Nexus 5X Googlebot/
  GoogleOther** (US/SC) deep-linking entry pages after sitemaps shipped (`b7fb42fd`). Same shape as
  tutor's 07-08 finding (3 "real" errors that were 100% one webdriver session). Add `bot_sessions` +
  `bot_pct` (UA `is_bot_user_agent` ∪ webdriver ∪ frequency-bot sessions) to `ErrorCluster`; badge or
  sink clusters with `bot_pct > 90%` as "mostly crawler". Cheap — same GROUP BY, conditional SUM.
  Complements the humans/bots audience toggle (which already filters *usage*, not diagnostic
  clusters). *(ported from tutor · LD urgency higher while Google is ingesting new sitemaps)*
  **↑ 2026-07-13: tutor + house have now SHIPPED this** — tutor's `build_error_clusters` carries the
  🤖-bot-only badge live, house's error tooling shows `sess`/`bot`/`stale` columns. Port tutor's
  implementation rather than re-designing. Re-grounded again 07-13 (US-SC 1,325 crawler / `Rejected` +
  `initial dict sync failed` + `Internal Error` all 100% bot — all hand-classified).
- **★ NEW — Sync-Health: name the server-side cause + RED "one-user-dominates" verdict** *(ported
  from house 07-07 Phase C · filed 2026-07-08 — grounded in TODAY's live P2).* LD's `build_sync_health`
  (`log-analytics.ts` ~line 1722) groups `sync_failed` by `context.kind` current-vs-stale + tracks
  stuck `(user,dict_id)` pairs, but a `kind:"other"`/`"unknown"` hides the real cause and the panel
  never flags user concentration. Enrich it to (a) **join concurrent `source='server'` error rows** to
  surface the constraint/table/message behind an opaque kind, and (b) turn the panel **RED and name the
  account** when `sync_failed` concentrates on one user. Today it would have said "**Greg (admin) stuck ·
  schema_outdated · 5-day-old build**" and "Zapotec editor · 3,531 retries" instead of an unactionable
  per-kind bar. *(ported from house)*
- **★★ NEW — Top-route attribution on the error-cluster panel** *(filed 2026-07-07 run 2 — grounded
  in TODAY's live entry-page loop; verified NOT present).* `ErrorCluster` (`log-analytics.ts` ~line
  230) has no route dimension, so pinning *where* a cluster fires means a hand-run
  `GROUP BY url-route` query — which this review had to do to discover that **100% of the 170
  `effect_update_depth_exceeded` rows fire on `/{dict}/entry/{id}` entry-detail pages** (bucket query
  returned `{ entry: 170 }`, zero elsewhere) and that the `RangeError: Maximum call stack` recursion
  is 100% on `/{dict}/entries?q={view:table}` (the **table view**). Add a `top_route` (most common
  normalized route for the cluster, reusing the existing `url_route` helper already powering the perf
  panel) + its share to `ErrorCluster`, shown inline in the ranked list. Cheap (one extra grouped
  read or a correlated subquery), and it turns "which surface is broken?" from a manual query into a
  glance. Complements the per-session breadth loop-flag above — breadth says *how* it breaks (loop
  vs. wide), route says *where*.
- ✅ **SHIPPED 2026-07-14 — Per-session error breadth + "⟳ loop" marker.** Ported alongside the
  bot-share item above: `ErrorCluster` now carries `sessions` (`COUNT(DISTINCT session_id)`) and
  `max_per_session` (max rows for the cluster within one session) — a high `max_per_session` is the
  "⟳ loop" marker. Server rows (no session) stay null. See `log-analytics.ts` `build_error_clusters`.
  *(Original entry below.)*
- **★★ NEW — Per-session error breadth on the error-cluster panel (loop-bug detector)** *(filed
  2026-07-07 — grounded in TODAY's live P1; verified NOT present).* The `ErrorCluster` shape
  (`log-analytics.ts` ~line 230) exposes `count` + `users` but **no per-session breadth**, so a
  client-side *infinite-loop* bug is indistinguishable from broad breakage by the ranked list alone.
  Today the WorldMap `getBoundingClientRect` loop logged **8,170 hits from ONE session / ONE user**
  and topped the cluster list looking like "1 user, low reach" — when it was actually a rAF storm
  firing every frame (see `.issues/worldmap-getboundingclientrect-loop-2026-07-07.md`). Add
  `sessions` (`COUNT(DISTINCT session_id)`) and `max_per_session` (max rows for this cluster within a
  single `session_id`) to `ErrorCluster`; surface a **"⟳ loop" flag** when `max_per_session` is high
  (e.g. > 100) so a runaway animation/effect loop is legible at a glance and doesn't get dismissed as
  "one user." Cheap — same GROUP BY, one extra `COUNT(DISTINCT …)` + a correlated per-session max
  subquery (or a windowed CTE). Directly answers a question this review had to hand-run today.
  **↑ 2026-07-13: tutor has SHIPPED the ⟳-loop marker on its `ErrorCluster`** (verified in its 07-12
  review). Port tutor's `build_error_clusters` `max_per_session` implementation to LD alongside the
  bot-share % item above — both proven in tutor now.
- **Stale-bundle error share as a headline % on the errors panel** *(ported from house · filed
  2026-07-07 — MEDIUM).* house's open item: "one number — % of window errors from stale (non-current)
  bundles." LD already computes `totals.stale_errors` but does **not** surface a stale-vs-current
  *share* on the analytics errors panel (verified: no `stale`/`bundle` reference in
  `admin/analytics/+page.svelte`). Today it would have instantly answered "is this error spike a live
  regression or just old tabs?" — the answer was **live** (10,854 of 11,482 errors on the two current
  builds), which a `stale_errors / errors` % would have shown at a glance. Display-only, data already
  in `totals`.
- **★★ NEW — "Sync health / stuck client_behind" panel** *(filed 2026-07-05 run 1 — grounded in a live
  P2; **reaffirmed + doubly-grounded 2026-07-05 run 2** after the source fix `f66b209c` shipped; see
  `.issues/dict-sync-client-behind-storm-2026-07-05.md`).* Run 1: the per-dict sync engine's
  `client_behind`/`schema_outdated` retry drove **9,862 `sync_failed` warn rows — 41.9% of ALL 24h
  logs** across 12 users (incl. an admin) and 34 dictionaries, **completely invisible on both
  `/admin/analytics` and `/admin/health`** (verified: `top_events` info-only ~line 904;
  `error_clusters`/`errors_by_version` only count `ERROR_LEVELS_SQL = ('error','unhandled_rejection',
  'crash')`; `sync_failed` ships at `warn` so it hits neither). **Run 2 update:** the source fix
  (`f66b209c`, live 15:38 UTC) works — **zero storm rows on the current build** — but 8,170 residual
  rows persist from ~3 stuck old-tabs (incl. admin Greg's own), still invisible. The panel is now
  doubly valuable: it would (a) *confirm* a fix by showing current-vs-stale-build `client_behind`
  volume, and (b) surface the distinct-(user,dict) "currently stuck" tabs so we can nudge a reload.
  Add: `sync_failed` volume by `context.kind` (client_behind/network/snapshot_expired/storage_lost/…)
  **AND by `app_version` (current vs stale)**, a distinct-(user,dict) "currently stuck" count, and
  age-of-oldest-unresolved per kind. Cheap — same shape as `error_clusters` but reading `level='warn'
  AND message='sync_failed'`.
  **✅ SHIPPED 2026-07-06 (commit `24b080b1`) — verified in code.** `build_sync_health` in
  `log-analytics.ts` (`SyncHealth`: `by_kind` current-vs-stale, `client_behind` split, `stuck_pairs`,
  `oldest_unresolved_at`, `stuck[]`) + the "Sync health" panel in `admin/health/HealthView.svelte`.
  LD's stuck-tab key is **`(user, dict_id)`** — more granular than tutor's `engine` key. The 07-06 run
  confirmed it surfaces the 33%-of-volume storm + names the stuck tabs without a hand query.
- **Sync health: 7-day `client_behind`-current sparkline** *(NEW 2026-07-06 · verified not present).*
  The shipped panel is **hot-window only**; a re-emergence of a `client_behind`-on-current-build storm
  (the "act now, new regression" signal) is only legible while you're actively looking. Add a small
  7-day daily bucket / sparkline of `client_behind.current` under the three stat cards so a slow
  re-appearance shows as a trend. `by_kind` already computes the current split — just needs a per-day roll.
- **"Admin auth-denials" strip on /admin/health** *(ported from house · filed 2026-07-06 · LOW).* House
  (NEW 07-05, grounded in a real admin lockout) surfaces repeated admin-gate denials on `/admin/health`.
  LD's numeric-level gating could do the same. LOW until LD observes a denial worth surfacing.
- **★ Deploy-settling error band** *(ported from tutor · filed 2026-07-05 run 2 — MEDIUM).* tutor
  buckets errors within `DEPLOY_TAIL_MINUTES` of a build's first `session_start` as "deploy settling"
  **even on the current build**, distinguishing expected post-deploy chunk/asset-manifest blips from a
  genuine regression. LD's `DailyPoint.stale_errors` only catches *old-build* errors; today's
  current-build `initial dict sync failed`/`effect` blips right after the 15:38 deploy are exactly the
  case this refines. Extend the errors fold with a settling window keyed on each `app_version`'s
  first-seen `session_start`. (house is borrowing the same item from tutor.)
- **Retention-cron staleness warn-styling on the pipeline strip** *(ported from house · filed
  2026-07-05 run 2 — LOW).* LD's pipeline-health strip *displays* `retention_ran_at` but has no
  staleness threshold / warn styling — a stuck cron renders as quiet plain text (house had the same gap
  and added a threshold, e.g. `!ran_at || > ~12h`, folded into the existing warn/drift class). Cheap,
  display-only, data already computed. LOW — LD's retention is currently fresh.
- **★ Fresh-viewer boot-health strip** *(filed 2026-07-04 run 2 — grounded in a live P1; ✅ SHIPPED
  2026-07-05, commit `daed5d93` — `BootHealth`/`build_boot_health` + the "Fresh-viewer boot health"
  panel on `/admin/health`, verified present with failed/recovered/non-recovery-rate/snapshot_expired +
  by-message + daily trend).* Caught the first real post-ship data point today: the 07-04 P1 cascade is
  down to a low single-digit/build trickle post-fix. **Refinement still open** (2026-07-05): the
  `recovered_sessions` proxy (a failed-boot session that later logs `entry_opened`) undercounts real
  recovery — e.g. a 07-05 `apatani` session hit the boot-cascade, then bounced (`visibility_hidden`
  ~2.4s later) without ever opening an entry, so it reads as "non-recovered" even though we can't tell
  whether the entries LIST actually rendered after the retry. See the "Intent→shown success event" item
  below — this is the concrete case that would benefit from it; consider prioritizing that item to
  sharpen `non_recovery_pct` specifically.
- ✅ **Synthetic uptime + latency panel** *(ported from house · 2026-07-04; SHIPPED 2026-07-05,
  commit `75243995` "Split admin analytics into usage and health dashboards" — `UptimeSummary`/
  `build_uptime` + the "Synthetic uptime" panel on `/admin/health`, verified: availability % + server
  TTFB/total p50/p95 daily trend from `uptime_probe` server rows). 2026-07-05 data: 162/162 probes ok
  (100% availability) — healthy).* house and tutor also independently shipped/are shipping the same
  panel this week (house 07-04, tutor building) — full convergence across all three apps now.
- **★ Geo-split Core Web Vitals (TTFB/LCP by region or distance-to-origin bucket)** *(filed 2026-06-30 —
  grounded in a real geo tax; **PARTIALLY SHIPPED** — verified 2026-07-05).* The TTFB half is live:
  `/admin/health` "Latency by geography" panel (`geo.ttfb_by_country` / `geo.ttfb_by_distance`,
  `build_ttfb_latency`) breaks down TTFB p50/p95 by country AND by distance-to-Boston bucket,
  human-only. **Still open: the LCP half** — the shipped Core Web Vitals panel (`web_vitals`) remains
  a single all-geo aggregate; LCP is not yet split by country/distance the way TTFB is. Extend
  `build_web_vitals` (or a sibling function) to bucket LCP the same way `build_ttfb_latency` does.
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
- ✅ **True unique-visitor counts via a cookieless persistent `visitor_id`** *(SHIPPED 2026-07-07,
  `.issues/persistent-visitor-id.md`).* The dashboard counted **sessions** (`session_id`), not
  long-lived visitors. **Jacob chose the localStorage persistent `visitor_id` over the server IP+UA
  `visitor_hash`** originally proposed here — the hash mass-collapses a whole shared-connection
  community (one NAT → one "visitor"), the exact failure common to LD dictionary communities, whereas a
  minted UUID has no systematic merge. Shipped: `remote-log.ts` mints/persists `ld_visitor_id` + stamps
  `context.visitor_id` (like `session_id`); `insert-client-log.ts` promotes it to a real column (logs.db
  + archive + shared.db legacy via migration `20260707c`); `rollup_day()` rolls distinct `visitor_id`
  per dict/day into `dictionary_daily_views(visitors, anon_visitors)`; the "Top dictionaries by viewers"
  panel shows a Visitors column + Visitor-days stat. No cookie/consent (GDPR non-concern — a random
  UUID never joined to identity). **Remaining for the public badge:** daily-distinct summed = visitor-
  *days*, not true monthly uniques — needs a UNION of raw visitor_ids (see
  `.issues/future/dictionary-public-visits-stat.md`). Superseded the `visitor_hash` idea (kept as a
  possible zero-client fallback only).
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
- ✅ **Server faults / schema-drift strip** *(ported from house · 2026-07-02; SHIPPED 2026-07-04,
  commit `eb26cc1b`).* `build_server_faults` → `ServerFaults` (clusters of `source='server' AND
  level IN ('error','crash')` grouped by `context.route`, newest-first with count + last-seen;
  `SCHEMA_DRIFT_PATTERN` tags the `SqliteError`/`no such table|column` class with a `drift` badge +
  a `schema_drift_count`) + a "Server faults" panel on `/admin/analytics` (`+page.svelte:337`). First
  real catch: the 07-04 `FOREIGN KEY constraint failed` 500 on `/api/dictionary/rhenic/changes`
  (surfaces as a `SqliteError` cluster, correctly untagged since it's not schema-drift).
- ✅ **★ Top missing i18n keys panel** *(filed + SHIPPED 2026-07-04).* `build_missing_i18n_keys`
  (`log-analytics.ts` → `MissingI18nKeys`: total / distinct_keys / sessions + top-25 keys by distinct
  sessions, human-only, hot window; keyed on `context.i18n_key` with a message-suffix fallback for
  older rows) + a "Missing translations" panel on `/admin/analytics` (stat pair + a
  Key/Locales/Sessions/Rows worklist table linking to `/translate`). Grounded in 07-04: **~875 warn
  rows across 237 distinct keys in 91 sessions**, previously invisible; the reporter already fires once
  per unique key per page session (`i18n/index.ts`), so it's a clean low-cardinality signal. Most keys
  are `sd.*` / `ps.*` / `psAbbrev.*` (Spanish-glossing dicts hitting untranslated semantic-domain /
  part-of-speech labels). Story + reader test added; verified light + dark. LD-first (LD keeps i18n in
  the DB); low-fit for house/tutor.

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
usage+geo metrics** (house only de-bots errors so far; tutor not at all) and the **Core Web Vitals**
panel. *(Correction 2026-07-05 run 2, flagged by house's 07-05 review: the **pipeline-liveness +
event-coverage** strips are NO LONGER an LD-only win — house has had both live in `HealthView.svelte`
for a while. Stop listing house as behind on this.)*

*Skipped as inapplicable to LD:* tutor's **Mobile-health / memory-OOM** RN panel (web-only) and
house's **/admin/revenue** dashboard (no payments).

### Cross-pollination update — 2026-07-05 (read house + tutor 07-04 reviews/backlogs)
- **Convergence: all three apps now have the synthetic-uptime panel.** house shipped it 07-04
  (`2bd9a66`), LD shipped it 07-05 (`75243995`, independently — not itself a port, but the same idea),
  tutor is ~90% wired (just needs its prober's ingest path + the panel). Nothing left to port here.
- **house's "Reader 404s / broken doc-links" panel** (07-04, house `.cron/log-reviews/2026-07-04.md`) —
  a count + recent-list of structured 404s on dead reader-document links. LD analog would be a "broken
  public entry/dictionary link" strip (dead shared links 404ing for anon visitors). **LOW** — LD's
  `+error.svelte` already demotes 404s to `info` (so they're cheap to query but not a source of
  error-cluster noise today) and no evidence yet of the same "shared link surviving deletion" pattern
  LD's structure would need (entries are hard-deleted via tombstone, not soft-deleted, so a dead link
  is rarer than house's doc-renumbering case). Revisit if it recurs.
- **house's "Distinct-session route ranking" borrow-from-LD** (07-04) confirms LD's top-routes-by-session
  work (07-03) was worth porting — no new action for LD.
- **★ LD win to flag back to house + tutor: audit YOUR sync engines for the same "retry-forever +
  unthrottled" gap.** LD's dict-sync-engine.ts (the newer, simpler per-dict engine) turned out to have
  NO `blocked_by_client_behind`-equivalent flag at all — unlike LD's own admin engine and house's
  `worker-engine.ts` (both of which DO gate on a `blocked_by_client_behind` flag before each retry).
  So this specific bug is NOT known to be shared — but the general lesson (any interval-driven sync
  retry loop must stop-or-throttle on a classified-fatal error, not just log-and-continue) is worth a
  quick self-check in both sibling repos' own worker/engine code, especially any per-document or
  per-entity (not just per-user) sync loop added since the shared `report-sync-failure.ts` policy was
  set (2026-07-02). See `.issues/dict-sync-client-behind-storm-2026-07-05.md` for the full writeup.

- **★ Propagate the three shared logging/dashboard primitives across house + LD + tutor as ONE
  grooming pass** *(batched 2026-07-08, from the 2026-07-07 run-2 review follow-ups).* Three
  loop-detection / storage-health primitives keep getting proposed piecemeal per-repo; groom them once
  as a coordinated cross-repo sweep so all three apps land the same shape (they share `remote-log.ts`,
  `ErrorCluster`, and the analytics stack, so each is a near-mechanical port):
  1. **Repeat-error coalescing in `remote-log.ts`** — emit the first *N* of an identical
     (`message` + `stack_head`) error per session, then coalesce to a periodic `"×N more"` row. Slashes
     runaway-loop junk volume AND makes a loop *more* legible (one `×8170` row screams "loop" vs 8k
     identical rows). Grounded in the 07-07 WorldMap rAF storm (8,170 byte-identical rows / 1 session).
  2. **Per-session loop-flag on the error-cluster panel** — add `sessions` (`COUNT(DISTINCT
     session_id)`) + `max_per_session` to `ErrorCluster` and a **"⟳ loop"** badge when
     `max_per_session` is high (>100), so a 1-session-8k-hit rAF/effect storm stops ranking as "1 user,
     low reach." (Already filed standalone for LD above — fold into this batch for house + tutor too.)
  3. **WAL/storage-health strip** — a small `/admin/health` panel surfacing local-DB storage health
     signals (OPFS/wa-sqlite VFS errors, WAL/journal state, `storage_lost`/`snapshot_expired`, quota)
     so a "storage broke for this class of clients" trend is visible in aggregate, not just per-incident.
  Do all three in one grooming pass across the three repos rather than three separate per-repo tickets.

## Sourced from
- `.cron/log-reviews/2026-07-09.md` (SEO crawl after sitemaps: ~10k Googlebot sessions; top error
  clusters 94–98% bot SQLITE_MISUSE; Greg + Zapotec editor still on 07-03 tabs; Sugstun FK ✅ fixed
  live via `71d18e34`; build-adoption + storage strips ✅ shipped; Phase C = bot share on clusters)
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
- `.cron/log-reviews/2026-07-02.md` (real-vs-noise daily-error split shipped; server-faults borrow reaffirmed)
- `.cron/log-reviews/2026-07-03.md` (first big real-traffic day; API-v1 panel + deploy-day fold +
  top-routes-by-session all SHIPPED; top-routes-by-session proposal grounded in the milang self-nav loop)
- `.cron/log-reviews/2026-07-04.md` (quiet day, all 07-03 fixes verified live; Server-faults panel
  SHIPPED; "Top missing i18n keys" panel proposal from 237 distinct missing keys/day; run 2 caught the
  P1 empty-dictionary snapshot-cursor regression, fixed 2026-07-05 `daed5d93`)
- `.cron/log-reviews/2026-07-05.md` (run 1: P1 fix + boot-health panel verified live; NEW P2 found —
  dict-engine `client_behind` retry storm, 41.9% of the day's log volume, invisible on both dashboards;
  uptime panel + partial geo-CWV split verified shipped; convergence check against house/tutor 07-04.
  run 2: P2 storm confirmed FIXED at source (`f66b209c`, zero on current build) — residual is old stuck
  tabs; entry-page `effect_update_depth_exceeded` fix found INCOMPLETE; `/og` `satori()` font-parse 500;
  deploy-settling band ported from tutor + retention-staleness styling ported from house)
- Phase D cross-repo read 2026-06-27 (house `error_audience`/`errors_by_version`/expected-bucket;
  tutor `error_clusters`/`KNOWN_NOISE`).
