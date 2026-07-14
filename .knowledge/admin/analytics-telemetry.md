# Analytics / telemetry — cross-repo shapes

Durable, non-code-derivable decisions behind LD's `client_logs` analytics (the "Google
Analytics + Sentry without the cruft" stack shared by LD + house + tutor). The code is the
source of truth for *how*; this page records *why* + the cross-repo conventions that no single
file states. Keep it high-level — each app tunes its own thresholds/business rules; copying what
works between the three is fine and encouraged, centralizing is not.

## Bot classification is a THREE-signal union, and the frequency signal is a two-signal GATE

A session is a bot if ANY of: (1) a crawler **UA regex** match, (2) `navigator.webdriver`
automation, OR (3) a **UA-frequency crawler** classification. The three apps converged on this
same union independently (LD's lives in `bot-sessions.ts` + `parse-user-agent.ts`, wired into
both the live dashboard reader and the forever rollup so hot and cold days classify identically).

The frequency detector exists because headless crawlers increasingly **spoof a plausible
desktop-Chrome UA AND carry no webdriver flag**, so signals (1) and (2) both miss them. Their
prod fingerprint: one identical UA string spawns *hundreds* of throwaway sessions in a day, each
firing `session_start` + `page_load` but **never a heartbeat** (they leave before the 30s
heartbeat).

The classifier is deliberately a **two-signal AND gate**, because each signal alone is wrong
(verified against prod, the reason it's a gate and not either half):
- **heartbeat-absence alone** would drop genuine sub-30s human reads (most real sessions never
  reach a heartbeat);
- **UA-frequency alone** would nuke a classroom / NAT of real users sharing one UA.

So: a session counts as a frequency-bot only when it emitted **zero heartbeats** AND its UA
produced ≥ N such zero-heartbeat sessions on the **same UTC day**. Signed-in sessions are excluded
from both the tally and classification (a real user by definition — protects a heavy admin who
racks up 20+ short reloads on one UA). A single dwelling human on a shared UA emits a heartbeat and
is removed from the tally, so real traffic can't push a shared UA over the line. The per-day
threshold (`MIN_UA_BOT_SESSIONS_PER_DAY`) is a business tuning knob, not a shared constant — each
repo sets its own.

house's implementation is the reference. LD added its copy in the 2026-07-05 logs.db split
(`b5bce3e8`); tutor + house both already had it. This is the standing example of the
"cross-repo copy what works, don't centralize" rule: same shape, independent thresholds.

## The bot split lives in the forever rollup, not just the live reader

Bots are bucketed into a parallel `bot:`-prefixed metric namespace at rollup time so the
Humans/Bots dashboard toggle works across the **full window including archived days** where the
raw UA is already gone. Human metrics keep the bare keys so a day's human trend doesn't jump when
it ages out of hot storage. Rolled-up `log_daily_sessions` stores the raw UA + heartbeat count +
webdriver flag per session so the reader **re-classifies from the materialized row** on finalized
days — the classification is never frozen into the metric.

## Per-dictionary viewership is a dedicated forever rollup, and it's "visits" not "visitors"

`dictionary_daily_views(day, dictionary_id, sessions, anon_sessions, visitors, anon_visitors)`
(LD-only, 2026-07-07) is a tiny FOREVER rollup written by `rollup_day()` from `dictionary_opened`
events — one open fires per dict entry (the `[dictionaryId]` layout mounts even on a deep-linked
entry), so it captures any entry into a dict, anonymous public visitors included, bots excluded via
the SAME classifier as the metric buckets. It feeds the `visits_30d` (activity) column of the admin
"Top dictionaries by unique visitors" panel; the panel's headline UNIQUE-visitor numbers come from the
separate `dictionary_monthly_visitors` monthly rollup (see below), not from summing this daily table.

Two durable decisions that aren't obvious from the code:

- **It lives in shared.db, NOT logs.db — on purpose.** The 2026-07-05 split moved the *raw rows*
  (disposable, not backed up, archived+pruned) to logs.db; the tiny *aggregates* deliberately stayed
  in shared.db (durable, backed up, "the rollups carry the history"). A forever public-facing stat is
  the opposite of throwaway, so it belongs with `log_daily_metrics`/`log_daily_sessions`. Cost is
  negligible (≤ one small row per dict-with-a-view per day). Server-only (absent from
  `SYNCABLE_TABLE_NAMES`) → never syncs, sits empty on admin clients like the sibling rollups. The
  future public number will reach browsers by baking it into the dict catalog/snapshot deliberately,
  never via this table.
- **`sessions` summed over a window = VISITS, not unique VISITORS.** A `session_id` resets per
  page-load, so a returning person is many sessions. Daily-distinct summed over a month is honest
  "visits/month". `anon_sessions` (session with no user_id — server-stamps user_id per request, so
  per-row null == session-level anon) ≈ outside public visitors, the star-dict brag number (a
  logged-in non-member still counts as a view but not as anon; good-enough approximation,
  member-exclusion deferred).

## Cookieless persistent `visitor_id` — for unique-VISITOR (not visits) counts

Chosen (2026-07-07) over the server IP+UA `visitor_hash` that earlier backlog notes proposed — the
hash mass-collapses a whole shared-connection community (one NAT gateway → one "visitor"), the exact
failure mode common to LD's dictionary communities. A random UUID minted once and kept in
`localStorage` (`ld_visitor_id`) has no such systematic merge; its errors are small + random +
mostly slight *over*-count (harmless for a "how many people" brag). Not personal data (we mint it,
never join it to identity), so **no cookie/consent surface** — GDPR is an explicit non-concern.

Plumbing mirrors `session_id` exactly: `remote-log.ts` reads-or-creates it (sync, before the first
`session_start`) and `enrich()` stamps `context.visitor_id` on every row; `insert-client-log.ts`
promotes it to a real indexed `visitor_id` column. **The column lives ONLY in logs.db + logs-archive.db**
(their DDL + a retrofit-ALTER loop) — NOT in shared.db. An earlier attempt added a `20260707c` migration
ALTERing shared.db's `client_logs`, but the 2026-07-05 split DROPS that table from shared.db at boot, so
the ALTER threw `no such table: client_logs` on every already-split server (boot-breaking; it also
surfaced as a swallowed failure in the entry-SSR endpoint's `get_shared_db()` call → admin tags read as
public). The migration was deleted: `insert_client_log` writes to logs.db, visitor_id postdates the split,
and shared.db's `client_logs` is transient/empty — it never needed the column. (Same reason
`log_server_event` must target logs.db, not a shared.db handle — see the sync-drift note below.)

### TRUE monthly-unique visitors — the forever `dictionary_monthly_visitors` rollup (2026-07-07)
The daily `visitors`/`anon_visitors` columns are DAILY-distinct: summed over a month they give
"visitor-DAYS" (a person on 5 days counts 5×), NOT unique visitors. True uniques require a **UNION** of
`visitor_id`s over the whole period. `dictionary_monthly_visitors(month, scope, visits, anon_visits,
visitors, anon_visitors)` stores exactly that, keyed by calendar month:
- `scope` = a `dictionary_id` (distinct visitors who opened that dict, from `dictionary_opened`) OR
  `'__site__'` (`SITE_SCOPE`) = distinct visitors who started ANY session, from `session_start` — the
  whole-site number for the homepage badge (NOT the sum of per-dict rows; one visitor across many dicts
  is one site visitor).
- `rollup_month()` scans raw `client_logs` from **hot logs.db ∪ archive** for the month, excludes bots
  via the SAME classifier sourced from `log_daily_sessions` (survives the raw prune), and unions
  `visitor_id ?? session_id`. `rollup_recent_months()` (a `run_log_retention_once` step, before
  archive/prune) recomputes every non-finalized month from the `monthly_visitors_finalized_through`
  watermark through the current month, then **freezes** completed months (a month is ≤31d old when it
  finalizes, well within the 60d raw window → full coverage, then never recomputed → survives forever).
- **Reader**: `build_top_dictionaries` reads this rollup for the month/prev-month unique columns, plus a
  live hot-log scan for the rolling 7d unique (14d hot window ⊇ 7d, exact) and the daily rollup for
  `visits_30d` (activity). It needs NO archive access. DEV: the cron is idle → the rollup is empty →
  monthly figures read 0 locally (7d still live); prod is fine.

"Visitors" universally means distinct **browsers/devices**, not humans (a shared family phone → one; one
person on 3 devices → three) — no cookieless method solves that, so any public surface says so. See
`.issues/true-unique-visitors.md` + `.issues/future/dictionary-public-visits-stat.md`.

## Client SPA navigation timing was logged-but-invisible until 2026-07-07

`log_navigation` has always folded a client-side SPA nav `duration_ms` (beforeNavigate→afterNavigate)
into the `navigation` event, but `build_performance` only aggregated `perf`-message rows
(`page_load`/`search`), so home→entry nav speed existed in the data and showed on no panel. The fix
reads the existing `navigation` rows into a synthetic `navigation` perf metric (+ by-destination-route
split) — zero new log volume. Pairs with LCP-by-route (grouping `web_vital` LCP rows by landing route).
The "Speed at a glance" strip on `/admin/health` surfaces page-load + navigation p50/p95 + LCP p75.

## Warn-level `sync_failed` is invisible to the standard panels (why "Sync health" exists)

A recurring blind-spot class, hit identically by LD + house: `top_events` reads only
`level='info'`, and the error panels read only `('error','unhandled_rejection','crash')`, so a
`warn`-level family (`sync_failed`, `dirty_rows_stuck`, i18n-missing-key) falls through **every**
standard panel. On 2026-07-05 a `client_behind` retry storm was 42% of a day's log volume yet
showed on neither dashboard. The **Sync health** panel (`build_sync_health`) closes it: per-kind
volume split current-vs-stale build, plus the distinct (user, dict) tabs still stuck on a stale
build. Both siblings filed the same panel independently — another convergence data point.

## Geography excludes admins — geo-only, heals over ~30d (all 3 apps, 2026-07-13)

The `/admin/analytics` **Geography** area chart excludes admin (allow-listed staff) sessions,
because a single admin browsing heavily skews "where visitors come from" (Jacob's own Malaysia
sessions dwarfed real traffic). Mechanism, mirrored in LD + house + tutor:

- `log_daily_sessions` gained a nullable **`user_id`** column (migration `20260713_*`); the rollup
  writer records the session's first signed-in user. `get_admin_user_ids({ shared_db })` maps the
  `$lib/admins` allow-list emails → `users.id`s.
- Admin sessions are dropped from the geo tally **only** — in `build_capability`'s per-session area
  pass (reader, the primary source) AND in the cold `geo:` metric rollup (`rollup_day`, the
  fallback seed). Session/user counts, device/OS/browser breakdowns, and everything else STILL
  count admins. house already had `get_admin_user_ids` (it excludes admin *reading* time from the
  per-book panel); the geo use reuses the same helper.
- **Gotcha — it heals forward, not retroactively.** Pre-migration `log_daily_sessions` rows have
  `user_id = NULL`, so historically-materialized cold days keep their admin geo until they age out
  of the 30-day window (or get re-rolled). The live/hot window is clean immediately; the whole
  window is clean after ~30d. This was an accepted tradeoff (vs. a heavier full backfill).
- house/tutor are single-or-few-admin, but the same skew applies, so the filter is uniform. Scope
  is deliberately geography-only — NOT applied to session/user/traffic counts.

## Deploy markers: same-day clustering, not one 80-count blob (shared ComboChart, 2026-07-13)

Deploy ticks on the Traffic/Errors ComboCharts are keyed by **day** (`first_seen.slice(0,10)`), so
same-day deploys share an identical x and always merge into one per-day tick with a count badge.
The pile-up bug ("⬆ 86" on one spot) was `EVENT_GAP` (single-linkage cluster gap in
`ComboChart.svelte`) at **28px** > one day's ~26px width, chaining the whole recent week into a
single cluster. Lowered to **18px** so distinct days separate; single-deploy days show just the
icon (no wide count chip → no overlap). `ComboChart.svelte` + `DeploysPanel.svelte` are
byte-identical across LD/house/tutor (see health `PARITY.md`) — mirror any change to all three.
`DeploysPanel` also gained horizontal minute gridlines (read a bar's duration off the axis without
hovering).

## `LogAnalytics.error_clusters` is DATA-ONLY — not rendered in any Svelte page (2026-07-14)

`ErrorCluster[]` is computed by `build_error_clusters` and returned in the analytics blob, but
NEITHER `/admin/analytics` nor `/admin/health` renders it (HealthView shows `server_faults.clusters`,
a different thing). Its only consumer is the nightly **log-review** command reading the analytics
JSON. So the per-cluster "badges" (`bot_pct > 90` = "mostly crawler", high `max_per_session` = the
loop marker) live in the *review's markdown*, not in code — porting tutor's enhancements meant adding
the DATA fields (`sessions`, `max_per_session`, `bot_sessions`, `bot_pct`), not a UI. Breadth is
computed from a per-(cluster, session) pass over hot rows keyed by message + stack_head; server rows
(NULL session_id) stay null.

## Admin analytics: one endpoint, scoped compute + progressive top-down loading (2026-07-14)

`/admin/analytics` (usage) and `/admin/health` (diagnostics) BOTH fetch the SAME
`/api/admin/analytics` endpoint and share `get_log_analytics`. It used to compute the ENTIRE
`LogAnalytics` blob (both pages' panels) on every call. Now `get_log_analytics({ scope })` gates the
cleanly-independent heavy builders:
- `light` — shared core only (daily / deploys / totals / geo AREAS / capability / top events+routes /
  by_source / event_coverage / error_clusters / pipeline).
- `usage` — light + api_v1 / top_dictionaries / missing_i18n_keys.
- `diagnostics` — light + performance / web_vitals / geo LATENCY / errors_by_version / server_faults /
  leader+sync health / build_adoption / storage / boot_health / uptime.
- `full` (default) — everything; the log-review reader keeps this. Cache key includes scope.

**Coupling constraint (why the split isn't cleaner):** `area_counts` is threaded
`build_usage_and_areas` -> mutated by `build_capability` -> fed with `build_geo_latency` into
`build_geo_areas`. So `geo.areas` / `geo.located_sessions` / `capability` MUST stay core (both pages);
only `geo`'s TTFB/LCP *latency* splits are diagnostics-gated. Skipped sections return typed
`EMPTY_*` consts (tsc-checked against the field types; mirror `empty_analytics`).

**Progressive render:** each `+page.ts` returns TWO streamed promises — `primary` (`scope=light`,
paints first) + `secondary` (the page's full half). `+page.svelte` renders `primary` immediately and
SWAPS to `secondary` once it resolves (`secondary ?? primary` — both are complete `LogAnalytics`
objects, so no fragile field-merge; the heavy panels show their normal empty states until the swap).
The `light` cache entry is shared by both pages.
