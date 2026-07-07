# Per-dictionary viewership rollup + navigation/load speed dashboard visuals

Context: new homepage → people now navigate directly from `/` into dictionaries/entries (SPA navs),
where before they were already inside a dict. Jacob wants (1) navigation + load speed well-tracked and
visible on the admin dashboard he watches, and (2) a **forever per-dictionary viewership rollup** so we
can later show "avg visits/month" on each (star) dictionary's public home page.

## Decisions (locked with Jacob 2026-07-07)
- **Storage: `dictionary_daily_views` table in shared.db**, modeled on `log_daily_sessions`. NOT logs.db
  (logs.db is disposable/not-backed-up/high-churn; the forever aggregates deliberately live in shared.db
  alongside `log_daily_metrics` + `log_daily_sessions`). The raw rows were the bloat that got split out,
  not the tiny aggregates. Server-only → absent from `SYNCABLE_TABLE_NAMES` → never syncs, sits empty on
  admin clients (same as the sibling rollups). Future public display will bake the number into the dict
  catalog/snapshot deliberately, never via this table.
- **Two counts per dict/day:** `sessions` (distinct human sessions that opened the dict) + `anon_sessions`
  (subset whose session has no user_id ≈ outside public visitors, the star-dict brag number). Bots
  excluded via the SAME classifier the rollup already applies.
- **CAVEAT to document:** session_id resets per page-load, so daily-distinct summed over a month = "visits",
  NOT unique "visitors". True monthly uniques need the backlogged cookieless `visitor_hash`. Frame the
  future public stat as **visits/month** until that ships.
- **Nav/load speed → `/admin/health`** (perf dashboard, matches the usage/health split). **Top dictionaries
  by viewers → `/admin/analytics`** (usage). No new logging for nav speed — aggregate the existing
  `navigation.duration_ms`. Add LCP-by-route too.
- **Do NOT touch `/log-and-fix`** — per-dict counts are pure stats for the dashboard, not nightly narration.
- **Public "visits/month" display = separate future issue (~1 month out).**

## Part A — Per-dictionary viewership rollup (forever)

1. ✅ DONE — Migration `shared-migrations/20260707a_dictionary_daily_views.sql`:
   ```sql
   CREATE TABLE IF NOT EXISTS dictionary_daily_views (
     day TEXT NOT NULL,
     dictionary_id TEXT NOT NULL,
     sessions INTEGER NOT NULL DEFAULT 0,
     anon_sessions INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (day, dictionary_id)
   );
   CREATE INDEX IF NOT EXISTS idx_dictionary_daily_views_dict ON dictionary_daily_views (dictionary_id, day);
   ```
   Server-only comment like log_daily_sessions. (Also add to the initial-migration server-only list comment.)
2. ✅ `rollup_day()` in `log-retention-cron.ts`: collect `dictionary_opened` rows `{ dict_id, session_id }`
   during the main loop; after bot classification, for non-bot sessions accumulate per-dict `sessions` set +
   `anon` set (session_activity has_user_id === false). Write in `write_all` transaction: full-day
   DELETE + INSERT (idempotent REPLACE, same as metrics/sessions). dictionary_id from `context.dictionary_id`.
3. ✅ Test in `log-retention-cron.test.ts`: seed dictionary_opened across human/anon/bot sessions, assert rows.
4. ✅ Reader `build_top_dictionaries(ctx)` in `log-analytics.ts` → `TopDictionaries`: cold rollup
   (`dictionary_daily_views` finalized days) + live tail (logs.db dictionary_opened, distinct sessions per
   dict, human-only, anon = user_id NULL); join `dictionaries` (name/url) from shared.db. Per dict: viewers
   7d + 30d + anon_30d; sorted desc; top ~25. Human-only always (usage/props stat). Add to `LogAnalytics`.
5. ✅ Panel "Top dictionaries by viewers" on `/admin/analytics` (`AnalyticsView.svelte` + stories + mock).

## Part B — Navigation & load speed (health)

1. ✅ Extend `build_performance` (log-analytics.ts): read `navigation` events (`context.duration_ms > 0`,
   `context.to`) → a `navigation` PerfSummary + daily series + `nav_by_route` (by normalize_route(to)).
   Add LCP-by-route (`web_vital` LCP grouped by url_route(url)→normalize_route). New fields on the
   `performance` shape / a sibling.
2. ✅ Friendly "Speed" card at top of `/admin/health`: Page load p50/p95, Navigation p50/p95, LCP p75 +
   30d p50 sparkline (PerfDailyPoint already per-metric; add navigation to it).
3. ✅ Update `HealthView.svelte` perf panel + stories + `mock-analytics.ts`.

## Part C — Docs + future
- ✅ AGENTS.md: mention `dictionary_daily_views` forever rollup (both AGENTS.md files where rollups noted).
- ✅ Knowledge: `.knowledge/admin/analytics-telemetry.md` — per-dict viewership rollup design + visits≠visitors caveat.
- ✅ New `.issues/future/dictionary-public-visits-stat.md` — public "visits/month" on dict home (~1mo out).
- ✅ `.issues/future/dashboard-improvements.md` — mark nav-timing + LCP-by-route + top-dicts panel shipped.

## Verify — ✅ ALL GREEN (2026-07-07)
- ✅ `pnpm test` — 1321 passed (new rollup tests for per-dict viewership + idempotency; analytics
  reader inline snapshot updated for the new fields).
- ✅ `pnpm check` — 0 errors (all `LogAnalytics` constructions typecheck: mock + insights fixtures updated).
- ✅ `pnpm lint` — clean on all changed files.
- ✅ svelte-look both dashboards — Default (light + dark) + Empty: "Top dictionaries by viewers" panel
  and "Speed at a glance" strip (sparklines) + nav/LCP-by-route tables all render; empty states OK.

## STATUS: COMPLETE. Not committed (awaiting Jacob's go-ahead).
Files: migration `20260707a_dictionary_daily_views.sql`; `log-retention-cron.ts` (+test);
`log-analytics.ts` (TopDictionaries + nav/LCP perf); `dashboard-format.ts`; `mock-analytics.ts`;
`insights.test.ts`; `AnalyticsView.svelte`; `HealthView.svelte`; AGENTS.md; knowledge + future issue.
