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
