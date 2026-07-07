# True unique visitors (per week / month, per-dict + site-wide) + entry-test fix

Follow-on from `.issues/persistent-visitor-id.md`. That shipped `visitor_id` capture + a DAILY-distinct
rollup (`dictionary_daily_views.visitors`) — but summed over a window that's "visitor-DAYS", not true
uniques. Jacob wants TRUE unique visitors per time period (week, month), per-dict AND a site-wide
combined monthly number for the homepage. Plus: fix the entry-SSR test failure (turned out NOT
pre-existing — see below).

## Two deliverables

### 1. Entry-test fix (the "other failure") — ROOT CAUSE FOUND
`api/dictionary/[id]/entry/[entryId]/server.test.ts > admin session widens tag visibility` fails
because `get_effective_admin_level({ db: get_shared_db() })` throws during `get_shared_db()` migration:
the uncommitted `20260707c_client_logs_visitor_id.sql` does `ALTER TABLE client_logs ADD COLUMN
visitor_id` on **shared.db**, but the boot-time split (`split_client_logs_from_shared`) DROPS
`client_logs` from shared.db. So on any already-split shared.db (all prod + dev since 2026-07-05) the
migration throws `no such table: client_logs` → boot breaks / test's admin resolution is swallowed.
The prior session's "pre-existing on main" was a false read: `git stash` doesn't stash UNTRACKED files,
so their own untracked migration stayed put during the stash test.
- **FIX: delete `20260707c`.** `logs.db` already owns `visitor_id` (its DDL + retrofit ALTER loop),
  and `insert_client_log` writes to logs.db only. shared.db's `client_logs` is transient/empty and
  already gone everywhere; visitor_id capture (2026-07-07) postdates the split (07-05) so no shared.db
  row ever had a visitor_id to carry. The migration is useless AND boot-breaking. ✅

### 2. True unique visitors
Retention: raw client_logs = hot (logs.db, 14d) + archive (logs-archive.db, 60d). True uniques need a
UNION of visitor_ids over the period; daily-distinct sums overcount. Two windows the dashboard shows:
- **rolling 7d** ("per week") → compute live from hot logs (14d ⊇ 7d), exact, no archive.
- **calendar month** ("per month") → forever monthly rollup, recomputed from raw (hot+archive) each
  cron sweep while raw exists, then FROZEN → survives the 60d prune → true monthly uniques forever.

#### New forever rollup: `dictionary_monthly_visitors(month, scope, visits, anon_visits, visitors, anon_visitors)`
`scope` = dictionary_id, OR `'__site__'` (SITE_SCOPE) for the whole-site combined count. Migration
`20260707d`. In shared.db (never pruned, never syncs) like the other rollups.
- per-dict scope: distinct over `dictionary_opened` events for that dict.
- site scope: distinct over `session_start` events (anyone who visited the site).
- `visitors`/`anon_visitors` = distinct `visitor_id ?? session_id`; `visits` = distinct session_id.

#### Cron (`log-retention-cron.ts`)
- `rollup_month({ month })`: bot set from `log_daily_sessions` for the month (same UA+webdriver+freq
  classifier, per-day freq keys unchanged); scan raw `dictionary_opened` + `session_start` from
  logs_db ∪ archive_db for the month; union per scope; full-month DELETE+INSERT (idempotent).
- `rollup_recent_months()`: recompute every non-finalized month from `monthly_visitors_finalized_through`
  watermark (or earliest raw month) through the current month; advance the watermark to `prev_month(now)`
  once covered so completed months freeze before their raw rows prune. Wired as a `step()` in
  `run_log_retention_once` after the daily rollups, before archive/prune.

#### Reader (`build_top_dictionaries`)
- Per dict: `visitors_month`, `anon_visitors_month`, `visitors_prev_month` (from monthly rollup),
  `visitors_7d` (live hot logs), `visits_30d` (daily rollup + live tail, activity context). Sort by
  `visitors_month` desc.
- Site: `site_visitors_month`, `site_visitors_prev_month`, `site_visitors_7d`.
- Monthly numbers are human-only (rollup has no bot variant); 0 for the 'bots' audience. Reader needs
  NO archive access (rollup = shared.db, 7d = hot).
- DEV caveat: cron doesn't run in dev → monthly rollup empty → monthly reads 0 in dev; the 7d live path
  still works; stories/mock cover visuals.

#### UI (`AnalyticsView.svelte`) + mock + tests
- Panel: site headline (visitors this month / last month) + per-dict table (Visitors this month · last
  month · 7d · Visits 30d · Anon share). Honest "visitors = distinct browsers, not humans" note.
- Update mock-analytics, insights fixture, analytics inline snapshot, add rollup_month test.

## Verify — ✅ ALL GREEN (2026-07-07)
- ✅ Entry-SSR test green (migration `20260707c` deleted; also fixes a real prod boot break).
- ✅ Also found + fixed a latent bug the deletion EXPOSED: `log_server_event({ db: shared_db })` in
  `sync-helpers.ts` (schema-drift warn) targeted shared.db's `client_logs`, which no longer has the
  `visitor_id` column (and is DROPPED entirely post-split in prod) → insert silently failed. Repointed
  to logs.db (threaded a `logs_db` param through `process_sync`), so drift is actually logged in prod now.
- ✅ `pnpm test` — 1329 passed (new rollup_month / rollup_recent_months tests: union-across-days true
  uniques, per-dict + `__site__`, bot exclusion, hot∪archive, idempotency, watermark freeze).
- ✅ `pnpm check` — 0 errors. lint clean on all touched files.
- ✅ svelte-look `/admin/analytics` Default — "Top dictionaries by unique visitors" panel renders
  light + dark: site-visitors headline (this/last month + 7d) + per-dict Visitors month · last month ·
  7d · Visits 30d · Anon.

## Docs updated
AGENTS.md (rollup list), `.knowledge/admin/analytics-telemetry.md` (monthly rollup design + the
20260707c/log_server_event corrections), `.issues/future/dictionary-public-visits-stat.md` (data now
true-unique), `.issues/persistent-visitor-id.md` (corrections), migration 20260707b comment.

## STATUS: COMPLETE. Not committed (awaiting Jacob's go-ahead).
Files: DELETE `20260707c`; NEW `20260707d_dictionary_monthly_visitors.sql`; `log-retention-cron.ts`
(+test); `log-analytics.ts` (+test snapshot); `sync-helpers.ts` (+test); `mock-analytics.ts`;
`insights.test.ts`; `AnalyticsView.svelte`; AGENTS.md; knowledge; issues.
