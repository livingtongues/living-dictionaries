# server/ — the Node process itself

How the single SvelteKit/adapter-node process behaves under load, and the rules that keep a request
path (and the container's health check) alive. Application architecture lives in [db/](../db/index.md);
this category is about the runtime.

- [synchronous-work-on-the-request-thread.md](./synchronous-work-on-the-request-thread.md) —
  measured 2026-07-28 from the `/og` outages: why a concurrency limit is nearly a no-op on a single
  thread, why a microtask slot-handoff makes starvation WORSE, why a time budget is what actually
  bounds it, how to move the work into a WORKER THREAD (the durable cure, and the two things that
  make shipping one in adapter-node awkward), and how to measure any of this without fooling
  yourself.
- [share-card-store-tiers.md](./share-card-store-tiers.md) — why the `/og` store is disk → R2 →
  render: the card space is ~104 GB against 76 GB of disk, so disk can only ever be a cache; the
  app's R2 token CANNOT create buckets (403, verified — new buckets are a Jacob task); why the cards
  get their own bucket rather than a prefix in the backed-up media bucket; each tier's measured
  latency; and the two properties (a free shed path, a fault that reads as a miss) that must never be
  traded away.
- [sveltekit-error-hooks.md](./sveltekit-error-hooks.md) — why an SSR 500 and a hydration 500 are
  indistinguishable by default (and the 2026-08-01 measurement proving every "Internal Error" this
  site has ever shown was raised in the BROWSER, not the server), the two SQL queries that tell them
  apart, why `error_id` must never live in the message, and why the client hook must NOT do recovery
  the way house's does.
- [catch-blocks-that-fabricate-state.md](./catch-blocks-that-fabricate-state.md) — the standing rule
  *"the catch block cannot recover what the throw destroyed"* (2026-08-02): the three properties that
  make a silent catch dangerous, the media-deletion sweep as the worked instance (an empty in-use set
  started a 30-day deletion clock on real user media), why house's shape was deliberately NOT copied,
  and the catches in this repo that are legitimate and must not be "fixed".
- [event-loop-stalls.md](./event-loop-stalls.md) — how to see (and how to fool yourself about) a
  frozen event loop: the `loop_lag_*` fields on `host_stats`, the `reset()` blind spot that makes a
  naive verification script report a clean loop straight through an 800 ms freeze, and the three
  synchronous stalls measured and moved off the request thread on 2026-08-02.
- [satori-fonts.md](./satori-fonts.md) — satori's script codes are version-specific AND `|`-joined, its FontLoader is cached by `options.fonts` array identity (so a same-array retry is a no-op and dynamic fonts accumulate), Noto Arabic is unparseable by its bundled opentype fork, colour emoji is not subsettable, and every font failure mode returns 200 with a valid-but-glyphless font. Also: what the 0.0.44 → 0.29 upgrade did and did not change visually.
- [build-version-stamp.md](./build-version-stamp.md) — why `kit.version.name` must never be a clock
  (the blank-page-with-HTTP-200 outage), the MEASURED fact that LD's build loads `svelte.config.js`
  four times across three realms that share a pid but not `globalThis` (SvelteKit's postbuild runs in
  worker threads), why `NODE_ENV` is the "is this a real build" discriminator, why
  `GIT_SHA || Date.now()` is a trap under `${GIT_SHA:-}`, and what changed downstream now that
  `app_version` is a commit sha instead of a timestamp.
- [forked-child-jobs.md](./forked-child-jobs.md) — the rules for moving a periodic job off the
  request thread: the fork-your-own-bundled-chunk trick, the trap that your module can silently land
  in the HOOKS chunk (and start a second cron scheduler in every child), what is different inside a
  child (`$env/dynamic/private` is empty, never `get_shared_db()`, keep it read-only + report over
  IPC), and why every such job must emit `blocking_ms` and not just `duration_ms`.
