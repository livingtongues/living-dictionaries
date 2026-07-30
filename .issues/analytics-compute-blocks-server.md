# The admin analytics compute freezes the whole site for up to 80 seconds

**Filed 2026-07-26 from the daily log review. Mitigated 2026-07-27 (see "What shipped" at the
bottom). ✅ FULLY RESOLVED 2026-07-30 — the compute left the serving process: `get_log_analytics`
now runs ONLY in a `nice -n 19` child process, once a day, and the dashboards read the JSON
checkpoint it writes (`analytics-snapshot.ts`). The measurements below are the reason that happened;
the mitigations they justified (SWR cache, disk persistence, `breathe()`, scope axis, boot warm-up)
are all deleted. Design + parity verification:
`vps-setup/.issues/analytics-and-cron-simplification.md` + `.knowledge/admin/analytics-telemetry.md`.**

## What's wrong

`get_log_analytics` is synchronous `better-sqlite3` work with no `await` anywhere in its path. While
it runs, the Node process serves **nothing else** — not readers, not contributor syncs, not scrapers.

Production `admin_analytics_computed` events (every uncached whole-window compute emits one; all 15
samples that exist):

| When (UTC) | scope | duration |
|---|---|---:|
| Jul 24 01:52 | usage | **56.5 s** |
| Jul 24 18:18 | light | **80.2 s** |
| Jul 24 18:18 | light | **60.1 s** ← same second as the row above |
| Jul 24 18:19 | usage | **54.6 s** |
| Jul 24 18:19 | usage | **54.3 s** ← same second again |
| Jul 24 18:20 | diagnostics | 37.0 s |
| Jul 25 03:51–03:52 | light/usage/diagnostics | 11.5 / 22.0 / 28.2 / 21.9 s |
| Jul 25 11:23–11:24 | light / usage | 13.1 / 27.6 s |

**Users felt it.** In the 18:17–18:22 UTC window on Jul 24, production logged **5 × `sync_failed`
with HTTP 502** (reverse proxy giving up on a blocked backend) plus 8 `server_behind` retries. Same
pattern at 03:51:59 on Jul 25. Whole-machine CPU averages stay ~2% — this is a single-thread block,
invisible in host stats, which is why it went unnoticed.

## Why it repeats

`site/src/lib/server/watermark-swr-cache.ts`:

- **A cold miss computes inline** (`get_or_schedule` → `compute({ reason: 'miss' })` in the caller's
  path) and is **not single-flighted** — only background *refreshes* are. Two simultaneous first
  visits each pay full price; that's the identical same-second pairs above.
- The cache is **in-memory only**, so every deploy discards it. LD deploys several times a day, so
  "cold" is the normal state.

Biggest single cost, measured by house against the analogous query: the distinct-user-agent scan.
LD's copy is `site/src/lib/db/server/log-analytics.ts:941`:

```sql
SELECT DISTINCT user_agent FROM client_logs WHERE received_at >= ? AND user_agent IS NOT NULL
```

Full scan across a **2.0 GB** `logs.db` to return a few hundred rows. House measured its version at
**6,756 ms cold → 3 ms** rewritten as a recursive index jump-scan.

## The port (house has this built and tested)

Source to copy from `~/code/house/site/src/lib/server/`:

1. **`breathe.ts` + a `stage()` runner** — yield the event loop before each blocking step. House
   measured its worst contiguous block go from 3,163 ms → 653 ms; a half-minute site-wide stall
   becomes a series of sub-second ones.
2. **`watermark-cache-file-store.ts`** — persist each scope's payload to
   `${DATA_DIR}/analytics-cache/*.json` stamped with the rollup watermark, so a restart paints from
   the last computed numbers (house: 315 ms) instead of recomputing. The staleness is already
   displayed on-page ("data computed N minutes ago").
3. **Single-flight the cold miss** in `watermark-swr-cache.ts` — the file is deliberately
   copy-paste-shared across all three repos (same API, same behavioural tests), so take house's
   version wholesale and keep the tests aligned.
4. **Index jump-scan for distinct user agents** (`log-analytics.ts:941`).
5. **Warm off the request path** — recompute after boot and when the retention cron advances the
   finalization watermark, so a human visit never pays.
6. **Day-chunk the big scans** (performance rows, live session grouping) so no single statement holds
   the thread.

## Related coverage item (same review, §5.3)

`admin_analytics_computed` records `total_ms` only; the per-stage breakdown exists solely behind a
developer env var. Record the stage map inside the existing event so future reviews see *where* the
time went without hand-measuring.

## Verification

- Re-measure `admin_analytics_computed` durations after the port; expect cold loads to disappear
  from the request path entirely and background computes to stay bounded.
- Confirm no `sync_failed` / HTTP 502 cluster coincides with an analytics compute window.
- Check `/admin/analytics` and `/admin/health` first paint after a deploy (target: sub-second from
  the persisted payload).
</content>


---

## What shipped (2026-07-27)

House's built fix, ported — not redesigned — plus the three-repo convergence of the controller.

**The shared controller** (`$lib/server/watermark-swr-cache.ts`) is now the canonical shape agreed
across all three repos: `get_or_schedule` / `get_or_schedule_async` / `refresh_async` / `settle()` /
`clear()` / `size`, options `{ read_watermark, on_background_error, schedule?, persistence? }`,
`compute({ reason })`, persistence `{ load, save, remove? }`, and **the watermark read BEFORE the
compute** everywhere (LD's ordering, per the cross-app review). LD adopted tutor's landed file
verbatim rather than re-litigating names; `watermark-swr-cache.test.ts` is the union suite (23 tests).
`breathe.ts` and `watermark-cache-file-store.ts` came from house.

**A real defect was found during the port and fixed in all three:** `#schedule_async_refresh` captured
no generation, so `#run_compute` read `this.#generation` when the refresh *started running* — a
`clear()` landing between "stale read schedules a refresh" and "the refresh runs" was invisible to the
guard, and the invalidated result repopulated the cache AND its durable file. The sync path was already
correct. LD's app-level `log-analytics-cache` suite is what caught it; house + tutor were sent the patch
and the regression test.

**In `log-analytics.ts`:**
1. `breathe()` + a `stage({ timings, label, run })` runner replacing `timed()` at all **25** call sites
   — every stage yields the event loop first and ALWAYS records its cost.
2. `stages` now rides `admin_analytics_computed` (closes coverage gap §5.3 — no more hand-measuring).
3. Payload persistence under `DATA_DIR/analytics-cache/*.json`, format version 1 — **bump
   `ANALYTICS_CACHE_FORMAT` whenever the `LogAnalytics` shape changes**, or a deploy hydrates the
   dashboard with a payload the new UI can't render.
4. `get_log_analytics` is async and single-flighted on the cold miss (the same-second duplicate
   computes on 2026-07-24 18:18/18:19 can't happen again).
5. The distinct-user-agent scan is a recursive **index jump-scan** (house measured the identical
   rewrite at 6,756 ms → 3 ms; LD's `logs.db` is 2.0 GB vs house's 1.4 GB).
6. **Warmed off the request path**: `warm_analytics_caches()` from the retention cron's new
   `after_sweep` hook (the sweep is what advances the watermark) and 30 s after boot via
   `start_analytics_warm_up()`.

**Not done (deliberate):** day-chunking the individual big scans (item 6 of the original plan). The
stage-level yields already break the block up; whether any single stage still holds the thread too long
is now *measurable* from the `stages` map in production, which is the right order to do it in.

**New tests:** cold-miss single-flight, disk mirroring, warm-up arms every landing key, and an explicit
**event-loop yield** test — a `setImmediate` queued when the compute starts must run before it finishes,
which is exactly what the HTTP 502s proved was impossible before.

**Verify after deploy:** `admin_analytics_computed` durations (and now their `stages`), no `sync_failed`
/502 cluster coinciding with a compute, and sub-second first paint on `/admin/analytics` after a deploy.
