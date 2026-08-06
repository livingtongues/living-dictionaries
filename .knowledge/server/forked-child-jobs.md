# Forked child jobs — the rules for moving background work off the request thread

*Established 2026-07-30 (`analytics-snapshot.ts`) and hardened 2026-08-04 when the audio-derivative
backfill was moved the same way. The pattern is in the code; these are the things that bit us.*

## When to reach for it

A periodic job belongs in a child process when it does **synchronous** work whose size grows with
the data: a full-table scan, a VACUUM, opening N database files, a multi-minute compute. On a
single-threaded adapter-node server there is no other cure — `better-sqlite3` is synchronous, and a
concurrency limit or a microtask handoff does not help (see
[synchronous-work-on-the-request-thread.md](./synchronous-work-on-the-request-thread.md)).

Two measured cautionary tales: the retention sweep held the event loop 115 s and cost two editors a
502 (2026-08-01); the audio-derivative sweep, running every 5 minutes in-process, took the typical
worst 5-minute stall from **65 ms to 623 ms all day**, with 27% of samples over 800 ms.

## The trick, and the trap under it

The Docker runner copies only `site/build`, so there is no `.ts` file to fork at runtime. But a
**bundled chunk is a real file at a real path**, and rollup preserves `import.meta.url` in its ESM
output — so the job forks the chunk that contains itself and re-enters through an env-var guard.

**The trap: you don't control which chunk your module lands in.** The audio backfill was first
written beside its cron entry point. `crons.ts` imports that; `hooks.server.ts` imports `crons.ts`
— so rollup folded the job into the **hooks chunk**, whose module body calls `start_crons_once()`.
Forking it would have started a **second cron scheduler inside every child**. Nothing in the source
hints at this; it was caught by grepping the built output for the guard env var.

**The rule: the child's entry module must be reached by a `import()` — a dynamic import is what
forces its own chunk** — and it exports its own `import.meta.url` so the parent learns the path
without guessing. Then verify against a real build:

```bash
grep -rl "YOUR_CHILD_ENV_GUARD" site/build/server | grep -v map   # must be ONE dedicated chunk
grep -c "start_crons_once" that-chunk.js                          # must be 0 (comments aside)
```

and fork it standalone with a scratch `DATA_DIR` before believing it works.

## What is different inside the child

- **`$env/dynamic/private` is EMPTY.** It's populated by `Server.init()` in `build/index.js`, which
  the child never runs. Anything the child needs must come from `process.env` (identical values —
  the container's env_file feeds both). This is why `r2-media.ts` reads `env[name] || process.env[name]`.
- **Never call `get_shared_db()`** — it runs migrations. Open read-only handles directly.
- **The child should not write.** Keep it read-only and report results over IPC so the PARENT owns
  every write and every `log_server_event` (the child's `console` dies with the container, and a
  short-lived process is the wrong place to own a WAL writer).
- `setPriority(0, 19)` + `ionice -c 3` are set by the child **on itself** — both need no privileges,
  and busybox's `ionice` applet exists in `node:24-alpine`.

## Report `blocking_ms`, not just `duration_ms`

A job that moved off-thread must prove it. `duration_ms` is the child's wall clock and says nothing
about the site; **`blocking_ms` is the time the SERVING process' event loop was actually held** —
the `fork()` call plus whatever the parent does per IPC message. Emit both on one completion event
per run, at `warn` above a request's worth of blocking. Without it, the next regression is again a
timestamp correlation against an unrelated meter instead of a measurement.

## Cadence is a design decision, not a default

The audio sweep ran every 5 minutes because that's what "keep it fresh" felt like. It is a
**backfill** — conversion happens on upload — so the honest cadence is daily, and Jacob's ruling was
to say so in the roster description. Ask "what is the real path, and what is this catching?" before
picking an interval; a job that no-ops 287 times a day is polling, not maintenance.
