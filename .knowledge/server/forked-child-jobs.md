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

## When the child MUST write (the exception, 2026-08-07)

"Keep it read-only" is the default because a short-lived process is the wrong place to own a WAL
writer — but some jobs' entire OUTPUT is rows. The weekly media sweep reconciles a full R2 listing
against the `media_objects` ledger; sending ~380k adopt/true-up/orphan decisions to the parent over
IPC would just move the work back onto the request thread one message at a time.

So it writes, following the log-retention child's precedent:

- open shared.db **directly** (`new Database(join(data_dir, 'shared.db'), { fileMustExist: true })`),
  never `get_shared_db()` — the rule about migrations is the one that never bends;
- a LONG `busy_timeout` (60 s). The child serves nobody and can afford to wait; the serving process
  is the one that must never block on a lock (its own logs.db timeout is 250 ms for the same reason);
- keep writes in bounded transactions rather than one giant one, so the lock is released often.

**Telemetry still goes through the parent**, even when the writes don't. The child has no logs.db
handle by design, so per-item alarms it discovers (here `media_sweep_dict_unreadable` /
`media_orphan_brake_tripped`) ride home as a CAPPED `alerts[]` array on the summary and the parent
emits them. Cap it: a systemic fault must not turn one summary into a thousand-entry IPC payload.

**Threading the handle beats a global override.** Every helper the child reaches
(`media-ledger`, `photo-variants`, `video-thumbnails`, `media-metadata-probe`) takes an optional
`db` defaulting to `get_shared_db()`. A `set_shared_db_for_child()` escape hatch would have been one
line instead of eight signatures — and a loaded gun in the serving process forever.

**Verify the split in the BUILT output, not by reading imports.** Two greps settle it:
the child's chunk must contain the guard (`CHILD === "1"`) and the job body while containing **zero**
cron-scheduler references, and the hooks chunk must contain only the `env` string the parent passes
to `fork()`. Then fork the real chunk with a scratch `DATA_DIR` and read the rows back.

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
