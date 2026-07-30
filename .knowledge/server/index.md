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
