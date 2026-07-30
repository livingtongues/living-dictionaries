# Synchronous CPU work on the request thread (what actually protects `/healthz`)

Measured 2026-07-28 against a production `node build` on a 2-core box (the same core count as the
VPS), while repairing the `/og` share-card outages. The numbers are in
`.issues/canonical-bot-detection-and-og-endpoint-shape.md`; this page is the part that generalises
to any synchronous work we put on a request path — satori/resvg, `sharp`, `better-sqlite3`
pipelines, Orama index builds.

Caddy health-checks every container every 3 s with a **2 s timeout**, and takes the container out of
rotation when it fails. So the question for any synchronous handler is not "is it fast enough" but
**"how long can it make a health check wait?"**

## Three things that are NOT obvious until you measure them

1. **A burst of expensive requests does not arrive as concurrent handlers.** While the thread is
   blocked inside render #1, the other connections sit in the accept queue; handler #2 only runs
   once #1 returns. Every render logged `wait_ms: 0` — a semaphore/concurrency limit is close to a
   no-op, because Node's single thread already enforced it. What hurts is the **backlog**: 20 new
   cards = 38 s of back-to-back synchronous work, and a `/healthz` landing behind it waited **28 s**.

2. **Handing a queued slot to the next waiter via promise resolution makes it worse.** Microtasks
   run before the loop returns to its poll phase, so two synchronous units chain inside ONE
   iteration and pending I/O is never serviced. Measured `/healthz` at **18.3 s** across a burst of
   8 — worse than having no queue at all. Hand off with `setImmediate` (check phase, after poll):
   `$lib/server/breathe.ts` used to be the canonical write-up of this; it was deleted 2026-07-30
   along with the analytics cache machinery it served (analytics moved into a niced child process,
   where there is no request to be polite to). The surviving reference implementation + explanation
   is `routes/og/render-queue.ts`.

3. **What actually bounds the damage is a TIME BUDGET, not a concurrency number.** "At most half of
   any 10 s window may be spent on this work" caps the share of the process the endpoint can take,
   which is the thing a health check competes for. Past the budget, return something cheap
   immediately. `/og`'s `render-queue.ts` is the reference implementation (budget + concurrency
   limit + wait deadline + queue cap, with an injectable clock so the window is unit-testable).

## Measuring it honestly

- **Probe from a separate process.** A probe sharing the test script's `undici` connection pool with
  the load requests measures the CLIENT's queueing: it reported `/healthz` at 14 s when plain `curl`
  from a shell showed 1–6 ms at the same moment. Use `curl -w '%{time_total}'` in its own process.
- **Read the server's own telemetry, not just the client timings.** `og_card_rendered` /
  `og_render_shed` rows in the run's `logs.db` are what proved `wait_ms: 0` and told us the queue
  wasn't engaging.
- Watch out for `mkdirSync` under `/proc` — it HANGS in this sandbox rather than erroring. Use "a
  file where a directory should be" (ENOTDIR) to test unwritable-path handling.

## The real cure: move the work off the thread (done for `/og`, 2026-07-28)

Everything above only *rations* the damage — the worst case stayed ~1–2 units of synchronous work,
because poll-phase FIFO can put another expensive request ahead of the health check. The durable fix
for any handler in this class is a **worker thread**. `/og` did it (`render-pool.ts` +
`render-worker.js`, `.issues/og-render-off-main-thread.md`); same box, same build, before vs after,
20 distinct cards:

| | in-process | worker |
|---|---:|---:|
| `/healthz` max during the burst | 757 ms | **136 ms** |
| health checks answered during the burst | 12 | **57** |

The count is the more honest metric than the latency: a blocked server doesn't answer a health check
*slowly*, it doesn't answer it at all until the loop comes back.

Two things that generalize to the next handler that needs this:

- **A worker can't import your app.** The Docker runner copies only `site/build`, so a `.ts` worker
  file next to your route simply isn't there at runtime. Ship the worker's SOURCE: author it as
  plain `.js`, import it with vite's `?raw` (inlined into the bundle at build time), spawn with
  `new Worker(source, { eval: true })`. Everything it needs then has to arrive via `workerData` or
  the job message.
- **Eval'd worker code is CommonJS, and bare specifiers resolve against `process.cwd()`** — not
  against the bundle. `import('satori')` inside one fails with
  `Cannot find package 'satori' imported from /tmp/[worker eval]` if cwd isn't the app dir. Resolve
  packages in the parent with `import.meta.resolve` and pass absolute `file://` URLs.
- Keep the queue/budget anyway. It stops the worker pegging the box's second core, and it is what
  sheds a backlog. With rendering off-thread the budget can be loose (`/og` went 0.5 → 0.9) and the
  wait deadline long, since waiting now costs a socket rather than the thread.

## Two costs of moving work off the request thread (learned 2026-07-28)

- **A single-threaded worker still needs its OWN serialization.** Bounding concurrency in the parent
  is not enough if the worker's message handler is `async`: two overlapping jobs then share native
  state. `/og`'s renderer failed 100% of the time for nine hours with
  `Failed to unwrap exclusive reference of Resvg type from napi value`, and a fresh worker recovers
  for only about a minute before the next overlapping pair poisons it again — so a container restart
  is not a workaround. Chain jobs inside the worker (`tail = tail.then(...)`).
- **Telemetry that fires only on the request path goes blind the moment the work leaves it.** LD's
  `admin_analytics_computed` was emitted only by the admin endpoint; after computation moved to the
  boot warm-up and the post-retention-sweep hook, the caches kept being rebuilt while the metric
  recorded nothing for days. Emit the cost event from the background path too, with a field naming
  the trigger — otherwise "no events" reads as "no computes". (2026-07-30: analytics went all the way
  off-process into a niced child. The lesson is now baked into the design — the child reports over
  IPC and the PARENT logs `analytics_snapshot_computed` with `reason`, `peak_rss_mb` and per-stage
  timings.)
