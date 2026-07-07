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

`dictionary_daily_views(day, dictionary_id, sessions, anon_sessions)` (LD-only, 2026-07-07) is a
tiny FOREVER rollup written by `rollup_day()` from `dictionary_opened` events — one open fires per
dict entry (the `[dictionaryId]` layout mounts even on a deep-linked entry), so it captures any
entry into a dict, anonymous public visitors included, bots excluded via the SAME classifier as the
metric buckets. It seeds the admin "Top dictionaries by viewers" panel and, later, a public
"visits/month" badge on star dictionaries' home pages.

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
  "visits/month"; true monthly *uniques* need the backlogged cookieless `visitor_hash`
  (dashboard-improvements.md). Frame the public stat as visits until that ships. `anon_sessions`
  (session with no user_id — server-stamps user_id per request, so per-row null == session-level
  anon) ≈ outside public visitors, the star-dict brag number (a logged-in non-member still counts as
  a view but not as anon; good-enough approximation, member-exclusion deferred).

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
