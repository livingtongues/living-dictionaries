# The daily retention sweep blocks the request thread for ~2 minutes and costs real users 5xx

Filed by the nightly log review, 2026-08-01. **Measured, not inferred.**

> ✅ **FIXED (uncommitted) 2026-08-02** — all three staged steps landed together in
> <File path=".issues/nightly-fixes-2026-08-02.md" />: (1) `log_retention_swept` with per-step
> timings, emitted by the parent; (2) event-loop lag on `host_stats`
> (`loop_lag_max_ms`/`loop_lag_p99_ms`); (3) the sweep moved into the SAME niced child as the
> analytics compute, running before it. One extra thing this issue didn't anticipate: moving a
> writer out converts "blocked by the work" into "blocked waiting for the lock", so the serving
> process's `logs.db` busy timeout had to drop 5 s → 250 ms or a `VACUUM` would have parked the
> request thread anyway. **house and tutor run the ported copy of this cron — broadcast when Jacob
> commits.** Delete this file once that's done.
>
> ✅ **RESIDUAL ALSO FIXED (uncommitted) 2026-08-03** — `.issues/nightly-fixes-2026-08-03.md` item 5.
> The residual after the child-process move was CROSS-PROCESS WRITE-LOCK CONTENTION, not the work
> itself: `rollup_day`'s single whole-day transaction held shared.db's write lock for a measured
> 15.4 s and the serving process (busy_timeout 5000) parked on it — one 8.3 s event-loop stall and
> one signed-in user's 502 on 2026-08-02. Now CHUNKED at 500 rows (`ROLLUP_WRITE_CHUNK_ROWS`), each
> day-DELETE its own statement, so the longest hold is milliseconds. shared.db's serving busy
> timeout was deliberately NOT dropped — on a DB carrying request-path writes that converts waits
> into user-visible errors. The child also self-`ionice -c 3` now (verified unprivileged inside the
> running prod container): `nice` is CPU-only and the two longest steps are pure disk (archive
> 20.6 s, VACUUM 40.0 s). When broadcasting to house/tutor, carry BOTH halves.

## What happens

`log-retention` (roster entry in `site/src/lib/db/server/crons.ts`) fires daily at 03:30 Pacific
(10:30 UTC) and runs `run_log_retention_once()` — rollups, the monthly unique-visitor union,
`archive_old_logs()`, and two conditional `VACUUM`s — **synchronously, with better-sqlite3, inside
the serving Node process**. The analytics compute was moved into a niced child on 2026-07-30
(`de9652f0`); the sweep that precedes it never was.

### Tonight's measurement

| Fact | Value |
|---|---|
| Sweep start (`db_metadata.log_retention_ran_at`, written from the sweep's own `now`) | 2026-08-01T10:30:00.756Z |
| Analytics child spawn (`after_sweep` hook) = sweep end | ≈10:31:56Z (10:34:08.285Z event − `duration_ms` 132,343) |
| **Blocking duration** | **≈115 s on the request thread** |
| Caddy `read: connection reset by peer` (upstream `:3000`) | 10:31:19 ×2, 10:31:45 ×3, 10:32:13 ×1 |
| Client-observed HTTP 502 (`sync_failed` `context.status`) | 10:32:13 ×2 — two signed-in users (`haidalanguage`, `bhutia-the-drenjongke`) |

A blocked event loop does not merely make requests slow: the listen backlog fills and the kernel
starts RST-ing new connections, which is exactly the `connection reset by peer` Caddy logged. There
was no deploy at that time (today's deploys: 03:20 and 11:16 UTC), so per the standing 2026-07-30
rule ("treat any 5xx OUTSIDE a deploy window as a new incident") this is an incident, and it is a
scheduled one that recurs every day.

A second, smaller instance the same night: 00:00:12 UTC, two Caddy resets + one client 502, with no
deploy and no cron event logged. The 15-minute `wal-checkpoint` cron (TRUNCATE against shared/logs/
archive, which "waits for readers to clear" by design) is the suspect, but it has **no duration
telemetry**, so this one cannot be proven.

## Why it matters beyond the two users

This is the last known violation of the standing law of 2026-07-27: *analytics and telemetry must
never block a request path.* The sweep exists purely to serve telemetry, and it is the single
longest synchronous stretch in the process — including two `VACUUM`s that rewrite whole files
(`logs.db` is 2.0 GB, `logs-archive.db` 1.26 GB), where a single VACUUM can dwarf the 115 s measured
tonight the day it triggers.

## Fix, in order

1. **Instrument first** (cheap, unblocks everything else): a `log_retention_swept` server event with
   `duration_ms` overall and per `step()` label, plus `days_rolled` / `archived` / `pruned` and
   whether each VACUUM ran and for how long. Today the sweep's only account of itself is a
   `console.info` that dies with the container, which is why this took a Caddy-log correlation to
   find. Any success-path event MUST be emitted (the failure event `log_retention_sweep_failed`
   already exists).
2. **Add event-loop lag to `host_stats`** (`perf_hooks.monitorEventLoopDelay`, p99 over the 5-minute
   window) so "something blocked the thread" is visible without correlating Caddy logs by hand. This
   is the general instrument; item 1 is the specific one.
3. **Move the sweep off the request thread.** The analytics child is the proven pattern in this repo
   (`analytics-snapshot.ts`: fork, `nice 19`, parent owns the telemetry write). The sweep writes,
   so it needs care the read-only child didn't: run it in the child *before* the analytics compute
   (same process, one fork, `after_sweep` becomes "the child does both"), keep the primary/standby
   gate, and keep the watermark ordering (rollups finalize before the checkpoint is computed).
   A VACUUM of a multi-gigabyte file can never be safe on a serving thread.

## Notes for whoever picks this up

- Cadence and ordering are documented in `crons.ts`; don't change the 03:30 Pacific pin — the point
  is the quietest hour, and it still is (host CPU averaged 3.0% over the window).
- house and tutor run the ported copy of this cron. If the fix lands here, broadcast it: the same
  synchronous sweep, on the same schedule, is in both.
- Don't "fix" this by moving the schedule. The traffic floor at 03:30 Pacific is not zero — tonight
  it caught two signed-in editors mid-sync.
