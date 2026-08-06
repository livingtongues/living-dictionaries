# Seeing a frozen event loop (and how the instrument lies to you)

Everything on this box is one Node process and one thread. A synchronous stretch — `gzipSync`, a
better-sqlite3 statement, `VACUUM` — makes the whole site unreachable for its duration: no request is
parsed, no response written, no health check answered. The kernel's accept queue fills and then
starts refusing, which the reverse proxy records as `read: connection reset by peer` and the visitor
experiences as a 502.

**None of that shows up in any host metric.** On 2026-08-01 the daily retention sweep held the loop
for ~115 s while `host_stats` reported host CPU averaging **3.0%** — one core pinned on a 2-core box
is 50% of one core's worth of work spread over a 5-minute average, and load1 barely moves. A blocked
loop looks exactly like an idle one from outside.

## The instrument

`$lib/server/host-stats.ts` carries `loop_lag_max_ms` + `loop_lag_p99_ms` on every 5-minute
`host_stats` row (ported from house 2026-08-02, `node:perf_hooks` `monitorEventLoopDelay`). One
histogram **per named tracker** (`host-stats-cron`, `health-request`), each read reporting max/p99
since *that tracker's* previous read and then resetting — so an ad-hoc `/admin/health` load and the
cron can't shorten each other's windows, and a shared global histogram can't report a lifetime
maximum forever.

Query it like any other server row: `message = 'host_stats'`, `context.loop_lag_max_ms`. A healthy
5-minute window on this box reads in the low tens of ms.

## ⚠️ The blind spot that will fool your verification script

`histogram.reset()` **discards the first sample after the reset** — it uses it as its new baseline.
Measured on node v24.16.0 (mustang, 2026-08-02):

| what the script does | reported max |
|---|---|
| `reset()` → immediately block 800 ms → read | **11 ms** (the stall is invisible) |
| `reset()` → 15 ms of normal loop turns → block 800 ms → read | **811 ms** ✅ |
| `enable()` → immediately block 800 ms → read | **11 ms** |

So a natural-looking check — *"reset the histogram, do the slow thing, read the histogram"* — reports
a clean event loop straight through a freeze, and you conclude the meter is broken (or worse, that
the code is fine). It isn't: in production, reads are five minutes apart, the baseline sample is
taken within ~10 ms of the reset, and every stall after that is recorded faithfully.

**To verify by hand, either** let the loop turn for a few ms after enabling/resetting, **or** measure
lateness of a 100 ms heartbeat timer instead — the heartbeat never lies:

```js
let worst = 0, last = performance.now()
const beat = setInterval(() => { const t = performance.now(); worst = Math.max(worst, t - last - 100); last = t }, 100)
// …do the suspicious thing, then await a turn of the loop before reading `worst`
```

## What was measured and removed on 2026-08-02

| stall | before | after |
|---|---|---|
| snapshot build `readFileSync` + `gzipSync`, 54 MB dictionary (runs on the REQUEST thread, every editor boot) | ~831 ms exclusive; a 100 ms heartbeat 751 ms late (re-measured on mustang) | `promisify(gzip)` + `readFile` → heartbeat 2 ms late, same total wall clock |
| daily log-retention sweep (03:30 PT) | ~115 s exclusive, six proxy resets, two editors 502'd | forked into the niced analytics child |
| `VACUUM` of the 2.0 GB `logs.db` | would have been minutes, exclusive | in the child — and the SERVING process now waits only 250 ms for logs.db's write lock (`SERVING_BUSY_TIMEOUT_MS`) rather than 5 s, so a maintenance window costs dropped telemetry rows instead of a parked request thread |

The last row is the non-obvious one: moving a writer into another process converts "the loop is
blocked by the work" into "the loop is blocked waiting for the *lock*", because better-sqlite3 waits
synchronously. Whenever background work moves out of the serving process, the serving process's
`busy_timeout` for the files it shares becomes a request-path property.
