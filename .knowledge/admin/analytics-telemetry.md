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

### Reading a MONTH out of this table — two traps that have already produced a wrong report

Both bit the 2026-07-31 business review, which reported July as a "complete month" when it was neither
complete nor uniformly device-keyed. Check both before quoting a monthly figure.

**1. An unfrozen month's row is a partial snapshot as of the LAST SWEEP, not the month.** The row for
the in-progress month is rewritten on every sweep, and the sweep runs *once a day* (03:30 PT). So the
July row sitting in the table at any moment during July only covers up to that day's sweep. July did
not become whole until the **first August sweep** (2026-08-01 10:30 UTC) recomputed it and advanced
`monthly_visitors_finalized_through` to `2026-07`. Concretely: read at 2026-07-31 21:00 UTC the row said
7,219 visitors / 14,706 visits; the frozen row says **7,332 / 14,945** — 14,105 raw rows in July's last
13.5 h were simply not in it yet. **The check is one query** — a month is trustworthy only when
`db_metadata.monthly_visitors_finalized_through >= that month`. Month windows are **UTC**
(`YYYY-MM-01T00:00:00.000Z` → next month), so "end of month" is UTC midnight, not PT.

**2. Rows before 2026-07-08 have no `visitor_id`, and the `visitor_id ?? session_id` fallback silently
turns "visitors" into "sessions" for that stretch.** `visitor_id` shipped mid-July-07 (coverage: 0 rows
through 07-06, ~46% on 07-07, ~100% from 07-08). For the earlier days every session is its own
"visitor", so uniques are **inflated** and the anonymous share is **understated** — signed-in sessions
stop collapsing to one device, which is the bigger distortion. In July: the frozen full-month figure is
7,332 visitors / 86% anonymous, but restricted to the device-keyed window (07-08 → 07-31) it is
**5,182 visitors / 97% anonymous**, and the signed-in visitor count falls from a nonsensical 998 to 170
(cross-checks against ~163 signed-in users). The tell is in the daily series: while `visitor_id` is
missing, daily `visitors == sessions` exactly. **July 2026 is therefore a valid corpus/traffic baseline
but only a partially valid *unique-device* one; August 2026 is the first fully device-keyed calendar
month.** June is not comparable at all (raw logs begin 06-26 because of the 60d prune, pre-cutover, 68
`session_start` rows total).

Aside: `anon_visitors` counts visitors with **≥1 signed-out session**, not "never signed in" — a person
who browses logged-out and later signs in on the same device lands in both columns.

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

## Admin analytics: a DAILY CHECKPOINT computed by a niced child process (2026-07-30)

Supersedes everything this page used to say about scoped computes, progressive tiers and the
stale-while-revalidate cache. The whole of that machinery — `scope: light|usage|diagnostics|full`
with its `EMPTY_*` skip-defaults, `WatermarkSwrCache` + its disk persistence, `breathe()` yields
between stages, the boot warm-up, the per-request `project()` freshness splices — existed for ONE
reason: `get_log_analytics` is 11–80 s of synchronous better-sqlite3 work, and it was running
inside the process that serves requests. It is all deleted.

**The shape now** (identical in house + tutor; fix one, port to the other two):
- The daily `log-retention` cron (pinned `at: 03:30` local) advances the rollup watermark, then
  **forks a child process** which self-`nice`s to 19, opens READ-ONLY handles, computes every
  (window × audience) payload the UI can request, writes each to
  `${DATA_DIR}/analytics/<range>-<audience>.json` (atomic temp+rename), reports its summary over
  IPC and exits. The PARENT writes the `analytics_snapshot_computed` telemetry, so the child stays
  read-only.
- The request path is `readFileSync` + `JSON.parse` + (LD/house only) one `/proc` read for
  `host.now`. **No queries.** A missing/corrupt/older-format file renders a "no checkpoint yet"
  state with a Recompute button — never a computation.
- Recompute (`POST /api/admin/analytics/recompute`, L3) forks the same child. It's the only way an
  operator can cause an analytics compute at all.

**Why a CHILD PROCESS and not a worker thread:** `nice` applies to a process (a thread inherits the
process priority and Node exposes no per-thread hook), the child's RSS is reclaimed by its exit, and
an OOM kills the child instead of the site.

**The in-flight guard must be released on `error`, not only on `exit` (fixed 2026-07-31).** Node
delivers `'error'` **WITHOUT** `'exit'` when a child fails to LAUNCH — verified by running node, not
read in the docs: `fork(path, [], { execPath: '/nonexistent' })` emits exactly one `error` (ENOENT)
and never an `exit`. The original code cleared the guard only in `exit`, so ONE launch failure left
`running` set for the life of the container and the 03:30 cron, the boot catch-up **and** the
Recompute button all answered `already-running` forever after — silently, and most likely under the
memory/process pressure that makes dashboards matter. A `settled` latch makes the release
exactly-once, because `error` CAN be followed by `exit` (a child that spawned then died) and a blind
second release would clear a *later* job's guard. Same defect shipped in house and tutor; each repo's
worker owns its own fix.

**How the child finds its own code — the load-bearing trick.** The Docker runner copies only
`site/build`, so a `.ts` file next to the module does not exist at runtime. But a BUNDLED CHUNK is a
real file at a real path and rollup keeps `import.meta.url` intact in ESM output, so
`analytics-snapshot.ts` forks *the chunk that contains it* and re-enters through an
`ANALYTICS_SNAPSHOT_CHILD=1` guard at the bottom of the file. Two consequences, both load-bearing:
- **`$env/dynamic/private` is EMPTY in the child** — it is populated by `Server.init()` in
  `build/index.js`, which the child never runs. Read `process.env` directly.
- The child must never import `hooks.server.ts` (it doesn't): no migrations, no crons, no listener.
- In DEV there is no bundle, so the job runs inline (`inline = dev`).

**Verified against production (2026-07-30):** the new compute was run on mustang against a copy of
living's real 2.1 GB `logs.db` and diffed against the payloads the OLD code had written on the box
minutes earlier — **19 sections byte-identical, all 29 finalized days identical**; the ~6 differing
counters were each strictly larger (the copy held ~5 more minutes of traffic), and
`missing_i18n_keys` went from empty to 449 keys because the old `scope === 'full'` gate meant NO
page ever computed it. Cost: 24–32 s and ~1.0 GB RSS per payload.

**What the FIRST real deploy measured (living, 2026-07-30).** humans 70 s / 702 MB RSS, bots 51 s /
1193 MB RSS, both under the 2048 MB child heap cap. Throughout the 81 s the child ran, `/healthz`
measured on-box stayed at **45–70 ms** — that single fact is the whole return on this rewrite, and
it is the number to re-measure if anyone ever proposes moving a compute back inline.

**Precomputing every combination executes code paths nothing ever ran.** This is the lesson, not a
footnote. The old design computed a payload only when a human opened the page with those exact
parameters, so a combination nobody clicked was never proven to work at all. Two latent bugs fell out
of the very first run of the checkpoint, both of them things a dashboard visit would have hit years
ago if anyone had visited that way:

- **The bots audience had almost certainly NEVER computed successfully in production.** Living's old
  `analytics-cache/` directory held only `30-humans-*` files. The first checkpoint run confirmed why:
  `Math.max(...values)` in `build_performance` threw `RangeError: Maximum call stack size exceeded`,
  because a spread passes one ARGUMENT per element and crawlers pile six figures of timings into a
  single route bucket. Humans never came close. Fixed with a `max_of` loop (`log-analytics.ts`, 5 call
  sites) — and the same latent bug was found and fixed in tutor, and still exists in house.
  Generalize: **never spread a data-derived array into a call.** `[...values].sort()` is fine (array
  literal, no argument list); `Math.max(...values)`, `arr.push(...other)` and `fn(...rows)` are not.
- **A ported component's CSS variables silently fell back.** `CheckpointBar.svelte` came from house
  and used `var(--text-muted, #64748b)` / `var(--border, #e2e8f0)`. Neither variable exists in LD's or
  tutor's `theme.css` (they're `--color-secondary` / `--border-color`), so the fallbacks won and both
  dashboards rendered light-mode colours in dark mode. A fallback value makes a wrong variable name
  invisible — when porting a component across these three repos, grep the target's `theme.css` for
  every var it names.

**A coupling constraint that survived the rewrite:** `area_counts` is threaded
`build_usage_and_areas` → mutated by `build_capability` → fed with `build_geo_latency` into
`build_geo_areas`. That trio must stay one ordered sequence inside the compute.

**Malformed-`context` read guard (2026-07-16, borrowed from house `7023529`):** every
`json_extract(context, …)` in `log-analytics.ts` is wrapped as
`json_extract(CASE WHEN json_valid(context) THEN context END, …)`. A single row with invalid JSON in
`context` (SQLite doesn't validate on write) would otherwise make `json_extract` **throw**, 500-ing
BOTH `/admin/analytics` and `/admin/health` at once. The `CASE` short-circuits to `NULL` on bad JSON
(`json_extract(NULL,…)` is NULL, never an error) — works identically in SELECT/WHERE/aggregate. **Any
new `json_extract(context, …)` MUST use this guard.** Paired write-side defense: `insert-client-log.ts`
uses `stringify_context_capped()` (not a blind `.slice()`), so oversized `context` is truncated to
still-valid JSON rather than cut mid-token — the DB can no longer persist invalid JSON in the first place.
