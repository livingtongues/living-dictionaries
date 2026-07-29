# `/og` renders share cards in a worker thread

**Done 2026-07-28.** Closes the residual left by
<File path=".issues/canonical-bot-detection-and-og-endpoint-shape.md" /> and the last item of
<File path=".issues/og-endpoint-load-outages.md" />: the store + queue removed the *repeat* cost of a
share card, but a genuine cache MISS was still ~800 ms of synchronous satori/resvg on the request
thread, so the worst case was "a health check waits for the render in front of it."

## What changed

| File | Role |
|---|---|
| `site/src/routes/og/render-worker.js` | NEW. satori + satori-html + resvg, the Google-font fallback loader, and the static-font retry — all inside a worker thread. Plain JS because it ships as a STRING. |
| `site/src/routes/og/render-pool.ts` | NEW. Owns the one worker: lazy spawn, job correlation, render timeout → terminate + respawn, crash → reject in-flight, idle shutdown, `on_event` telemetry hook. |
| `site/src/routes/og/component-to-png.ts` | Now only does the Svelte SSR render (markup string) and hands it to the pool. satori/resvg imports are GONE from the server bundle's main thread. `classify_og_failure` gained a `'worker'` class. |
| `site/src/routes/og/+server.ts` | Queue retuned for off-thread rendering (below). A `'worker'`-class failure skips the text-only retry — a dead renderer fails it identically and would cost a second 20 s timeout. |
| `site/vite-plugins/raw-fonts.ts` | The `.ttf`→bytes plugin, extracted out of `vite.config.ts` so **vitest** gets it too (without it a test that really rasterizes hands satori an asset-URL string). |
| `site/tools/og-load-check.mjs`, `site/tools/gen-og-props.ts` | The burst harness used for the numbers below. Health samples come from `curl` in a separate process — see the trap in `.knowledge/server/…`. |

### How the worker is loaded (the only tricky part)

`?raw` inlines `render-worker.js`'s TEXT into the server bundle at build time, and the pool spawns it
with `new Worker(source, { eval: true })`. The alternative — a real file at a real path — does not
survive the Docker runner, which copies only `site/build`. Consequences, both deliberate:

- the worker can't import project files, so the font arrives in `workerData` and everything else in
  the job message;
- eval'd worker code is **CommonJS** (a top-level `import` is a syntax error), so packages load via
  dynamic `import()`. The parent resolves them with `import.meta.resolve` and passes absolute file
  URLs, because a bare specifier inside an eval'd worker resolves against **`process.cwd()`**
  (verified: it fails with `Cannot find package 'satori' imported from /tmp/[worker eval]` when cwd
  is wrong). The bare name stays as a fallback if `import.meta.resolve` is unavailable.

### Queue retuning (`+server.ts`)

`busy_ratio` 0.5 → **0.9** and `wait_deadline_ms` 4000 → **8000**. The 0.5 budget existed to keep the
*request thread* free; the worker does that structurally now, so the budget's only remaining job is
to stop one core being pegged for a whole window. Waiting is likewise free for everyone else, so
more requests can hold out for a REAL card. `max_waiting` stays 12 — at production render times
(~800 ms) an 8 s deadline means the ~10th waiter is the last one that can still be served, so a
deeper queue would only manufacture shed responses.

## Measured — production build (`node build`), 2-core box, before vs after side by side

Both servers built from the same tree (the "before" one from `git stash`), same props, same harness,
`/healthz` sampled by out-of-process `curl` every 50 ms.

| Burst of distinct cards | | before (in-process) | after (worker) |
|---|---|---:|---:|
| 20 | `/healthz` p50 | 3 ms | **2 ms** |
| 20 | `/healthz` **max** | **757 ms** | **136 ms** |
| 20 | health checks answered during the burst | 12 | **57** |
| 100 | `/healthz` p50 | 1 ms | **2 ms** |
| 100 | `/healthz` max | 236 ms | **140 ms** |
| 100 | health checks answered during the burst | 9 | **49** |

The **sample count** is the honest headline: during a burst the old server could answer a health
check roughly every 260–590 ms (the sampler was blocked, not slow), the new one answers at the
sampler's full rate. Caddy checks every 3 s with a 2 s timeout, so what kills a container is one
badly-timed check, and `max` is the number that has to stay small.

Scale caveat, stated plainly: cards on this box render in ~200 ms (text-only, faster CPU), against
**700–840 ms in production with a photo**. The before-column therefore under-states the production
case by ~3–4×, which is exactly how a 757 ms local worst case was a 3,251 ms production one.

Unit-level proof of the same thing, in the suite: `render-worker.test.ts` renders a REAL 1200×630
card through the real worker while sampling this thread's event loop — 544 ms render, **7 ms worst
stall** (asserted `< 250 ms`).

### Other verification

- ✅ A real production card URL (`/sibe/entry/pGxAn5gkEMN1SfLfcgwl`, Manchu, with a WebP photo and
  Chinese glyphs) rendered locally through the worker is **byte-identical** to what production
  serves today — 221,491 bytes, same PNG. The dynamic Google-font fetch works from inside the worker.
- ✅ Dev server (`vite dev`, port 3041): card renders, 781 ms cold — the `?raw` + eval path works
  under vite-node SSR too.
- ✅ Telemetry intact: `og_card_rendered` rows show `render_ms: ~200`, `wait_ms` up to 2.7 s;
  `og_render_shed` for the rest. No `og_render_worker_*` events across ~250 renders.
- ✅ The spare-tyre generic card still warms in the background and answers shed requests (58 KB).
- ✅ RSS after ~120 renders: 294 MB, 14 threads.
- ✅ `pnpm test` 308 files / 2,257 tests · `pnpm check` 0 errors · `pnpm lint` clean · `pnpm build` ok.

## Deliberately not done

- **No in-process fallback if the worker can't spawn.** Rendering on the request thread is the thing
  this removes; a card is not worth an outage. `/og` serves its generic card and logs
  `og_render_worker_unavailable`.
- **Only ONE worker.** Two would buy throughput on an endpoint nothing waits on, using the core the
  request thread needs.
- **`card-image.ts` (the sharp transcode + photo fetch) stays on the main thread** — sharp is async
  and runs on libuv's pool, so it never blocked the loop; the 2026-07-27 measurements had it at
  56–88 ms for 8 concurrent transcodes.

## Post-deploy check (fill in after the next deploy)

- [x] `/healthz` stayed responsive enough that the prior user-visible 502 storm stopped: the last
      HTTP 502 `sync_failed` row was 05:30 UTC, before the worker deployment completed.
- [x] Diagnosed and repaired **72 `og_render_worker_timeout` rows** plus the post-12:15
      fallback-render storm. One worker accepted overlapping async message handlers, so concurrent
      calls reused napi `Resvg` state and failed with `Failed to unwrap exclusive reference of Resvg
      type from napi value`; the failures then cascaded into 20-second timeouts. Worker-local
      rendering is serialized and a real eight-card concurrency regression test passes.
- [x] Coalesced routine success, shedding, and repeated render-failure telemetry into one-minute
      summaries while retaining worker death/timeout events immediately.
- [x] Queue shedding is bounded and behaving as designed under the crawler flood: `queue_full`,
      `wait_deadline`, and `busy_window` return the generic card instead of risking site availability.

## Production status at 21:05 UTC 2026-07-28 (log-review run 2, read-only)

The diagnosis above is right and the fix passes its tests locally — but **it never reached
production**: the repair to `render-worker.js` / `+server.ts` / `component-to-png.ts` is still
uncommitted in the mustang working tree, and `main`'s newest commit (`97444112`, 11:20 UTC) predates
the failure. Production numbers at 21:05 UTC:

- **18,633** `Failed to unwrap exclusive reference of Resvg type from napi value` rows since
  12:15 UTC — effectively 100% of render attempts.
- **Zero** `og_card_rendered` events after 17:26 UTC; `/data/og-cache` (1,020 files, 175 MB) has not
  been written since that minute.
- Two different card URLs fetched live both return the identical 58,460-byte **generic** card, so
  every social/link preview of any Living Dictionaries page is currently generic.
- 119 twenty-second worker timeouts (still 1–12/hour), a downstream effect of the same poisoned
  renderer.
- Cost: **72,206 server log rows today (79% of all rows)**, and host CPU average 16.5% vs ~4% on a
  quiet day.

Deploy check to run afterwards: `og_card_rendered` returns to hundreds/hour, `og_render_failed`
`reason:"render"` goes to ~0, and the og-cache file count grows again.
