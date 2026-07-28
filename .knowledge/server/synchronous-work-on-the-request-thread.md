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
   `$lib/server/breathe.ts` exists for exactly this and its doc comment is the canonical
   explanation.

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

## Residual, and the real cure

With all of the above, the worst case is still ~1–2 units of synchronous work (poll-phase FIFO can
put another expensive request ahead of the health check). For `/og` that is ~0.8–1.7 s in production
against a 2 s timeout — under it, but thin. The durable fix for any handler in this class is to move
the work **off the main thread** (worker thread or a sidecar process). Not done for `/og` yet.
