# Boot analytics warm-up runs on BOTH blue and green → whole-site 503 after every deploy

**Filed 2026-07-29 from a mustang prober triage (living probed `https://livingdictionaries.app/` → HTTP 503).
Severity: 🔴 P1 — ~45 s of hard "no upstreams available" after every deploy, several deploys/day.
READ-ONLY diagnosis — nothing changed on the box. Site self-recovered at 13:10:57 UTC.**

## Root cause (one line)

`start_analytics_warm_up()` in <File path="site/src/hooks.server.ts" line="54" /> is gated on `!dev`
**but not on `IS_STANDBY`**, so the standby container runs the same three whole-window analytics
computes as the primary, at the same moment, on a 2-core box — and Caddy loses *both* upstreams.

```ts
// site/src/hooks.server.ts:53-54  — today
if (!dev)
  start_analytics_warm_up()
```

Crons were correctly gated (`start_crons_once` early-returns on `env.IS_STANDBY === 'true'`, and
green's log says so: `[crons] IS_STANDBY — all crons disabled…`). The warm-up is the one boot-time
background job that escaped the audit — exactly the failure mode vps-setup's AGENTS.md warns about:
*"audit for ALL of them (crons, queue workers, interval timers, snapshot builders), not just the obvious."*

Note commit `14c684e6` ("Schedule crons on wall clock…", deployed 06:20 today) already fixed the
*cron* boot burst for this same symptom — its comment literally cites "the Living 503, 2026-07-29".
It just missed this call.

## Evidence — the 13:03 deploy

`BOOT_WARM_DELAY_MS` is 30 s, and both containers boot ~30 s apart, so the two warm-ups overlap:

| UTC | Event |
|---|---|
| 13:03:40 | deploy starts (sha `72dca5ea`) |
| 13:07:24 | `sveltekit_green` starts → warm-up armed for **13:07:54** |
| 13:07:57 | `sveltekit_blue` starts → warm-up armed for **13:08:27** |
| 13:08:46 | `analytics-cache/30-humans-light.json` written |
| 13:08:55 | Caddy: `host is up sveltekit_blue` (i.e. it had gone *down*) |
| 13:09:56 | `analytics-cache/30-humans-usage.json` written |
| **13:09:59–13:10:43** | **Caddy `no upstreams available` ×265** → Cloudflare 503 → prober alert |
| 13:10:54 | `analytics-cache/30-humans-diagnostics.json` written |
| 13:10:44 / 13:10:54 / 13:10:57 | blue, green, blue back up — **outage ends as the last compute finishes** |

Direct proof the event loop (not the network, not Docker) was the problem: during the window,
`/healthz` — a static handler with zero I/O — timed out at **8 s** on `127.0.0.1:3001`, while
`/` on the same container answered 200 in 0.77 s once the compute finished.

```
3001 /healthz: 000 (timed out, 8.0s)     ← during warm-up
3002 /healthz: 200 (0.0033s)
3001 /healthz: 200 (0.0028s)             ← after 13:11
```

Inputs are big enough to be genuinely CPU-bound: `logs.db` **2.17 GB**, `logs-archive.db` **1.19 GB**,
`client_logs` **1,298,535 rows**, on a **2-core / 8 GB** box. `breathe()`/`stage()` yields between
stages, but with two containers scanning simultaneously there is no spare core, so each "sub-second"
stage stretches past Caddy's `health_timeout 5s`; `health_fails 3` then marks the upstream down.

## The control experiment (same logs, same day)

At **12:27** the 6-hourly log-retention cron ran its `after_sweep: warm_analytics_caches` hook
(`logs-archive.db` mtime = 12:27). That path IS standby-gated, so only **blue** warmed:

- blue flapped down/up 4× (12:27:43 → 12:28:35)
- green stayed healthy → Caddy failed over → **zero `no upstreams available`, no outage**

One container warming = invisible. Both warming = outage. That is the whole bug.

## It recurs on every deploy

Deploys today at 04:39, 06:20, 08:23, 09:55, 13:03 — and Caddy logs a `host is up` flurry ~4 min
after each (06:23–06:28, 08:26–08:30, 09:58–10:02, 13:04–13:10). The 10:00 minute alone holds
**214** errored requests. Today's 503 was not new; it was the first one the prober happened to sample.

## Proposed fix (NOT applied)

**1. Gate the warm-up on the standby flag** — one line, mirrors `cron-scheduler.ts`'s idiom exactly.
`env` (from `$env/dynamic/private`) is already imported in `hooks.server.ts`.

```diff-ts
 // A fresh container's in-memory analytics cache is empty, so warm it off the
-// request path (delayed …).
-if (!dev)
+// request path (delayed …). NEVER on the standby: the warm-up is three
+// whole-window scans of a 2 GB logs.db, and on a 2-core box both containers
+// doing it at once stalls BOTH event loops past Caddy's 5 s health timeout —
+// no healthy upstream, site-wide 503 (2026-07-29). Green reads the payload
+// blue persisted under DATA_DIR, which is what that file store is for.
+if (!dev && env.IS_STANDBY !== 'true')
   start_analytics_warm_up()
```

This is safe by design: the payloads are persisted to `${DATA_DIR}/analytics-cache/*.json`, and
`DATA_DIR` is **shared** by both containers — so green still serves the numbers blue computed, and
schedules a background refresh if an admin lands on it during a failover.

**2. (Optional, defence in depth)** Have `warm_analytics_caches()` skip a scope whose persisted file
is already stamped at the current rollup watermark. Today every boot recomputes all three scopes
even when the previous container computed them seconds earlier — the 13:03 deploy recomputed numbers
that the 12:27 retention sweep had just produced.

Not proposing a Caddy `health_timeout` bump: that hides a real 3-minute stall rather than removing it.

## Verify after applying

```bash
# deploy, then watch: only ONE container may go unhealthy, and the site must never 503
ssh living 'docker logs -f caddy 2>&1 | grep -E "no upstreams|host is up"'
ssh living 'docker logs sveltekit_green | head -5'   # expect no analytics warm-up work
watch -n2 'curl -sS -m 10 -o /dev/null -w "%{http_code}\n" https://livingdictionaries.app/'
```
