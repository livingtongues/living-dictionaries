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

## Warn-level `sync_failed` is invisible to the standard panels (why "Sync health" exists)

A recurring blind-spot class, hit identically by LD + house: `top_events` reads only
`level='info'`, and the error panels read only `('error','unhandled_rejection','crash')`, so a
`warn`-level family (`sync_failed`, `dirty_rows_stuck`, i18n-missing-key) falls through **every**
standard panel. On 2026-07-05 a `client_behind` retry storm was 42% of a day's log volume yet
showed on neither dashboard. The **Sync health** panel (`build_sync_health`) closes it: per-kind
volume split current-vs-stale build, plus the distinct (user, dict) tabs still stuck on a stale
build. Both siblings filed the same panel independently — another convergence data point.
