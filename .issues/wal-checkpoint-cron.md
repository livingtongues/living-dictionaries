# Server WAL-checkpoint cron (central DBs) + per-dictionary WAL investigation

**Status:** ✅ **Cron ported + wired (uncommitted).** 📊 **Per-dict investigation complete — report
below; no per-dict cron needed now.** Sourced from the 2026-07-06 fleet review (house added the cron;
LD ports it). Jacob reviews/commits.

## 1. ✅ WAL-checkpoint cron — ported from house (Task 2)

House's proven cron (`site/src/lib/db/server/wal-checkpoint-cron.ts`, commit `4e52902`; shrank a
189 MB shared.db WAL to 80.5 KB in prod) is ported to LD:

- **`site/src/lib/db/server/wal-checkpoint-cron.ts`** — `wal_checkpoint(TRUNCATE)` every 5 min on
  LD's **central DBs only**: `get_shared_db()` / `get_logs_db()` / `get_log_archive_db()`. Silent on
  healthy runs; emits a queryable `wal_checkpoint_incomplete` server event (via `log_server_event`,
  which lands in `logs.db`) only when a reader pins the WAL past the busy_timeout. Singleton
  (`Symbol.for('living.wal-checkpoint-cron.state')`), `.unref()`ed, **dev/build-dormant +
  IS_STANDBY-gated** — identical gating to LD's existing `log-retention-cron`.
- **`wal-checkpoint-cron.test.ts`** — house's test ported onto a real better-sqlite3 in-memory DB:
  TRUNCATE reclaims the -wal to 0 bytes; a pinning reader reports `busy=1` without throwing;
  `run_wal_checkpoint_once` returns one result per supplied DB.
- **`hooks.server.ts`** — registered via `start_wal_checkpoint_cron_once()` alongside the other crons.

### Why LD needs it — prod measurement (2026-07-07, `ssh living`)

| DB | .db size | -wal size | WAL / DB |
|---|---|---|---|
| `logs.db` | 292 MB | **202 MB** | 0.69× |
| `shared.db` | 13 MB | **150 MB** | **11.4×** |
| `logs-archive.db` | 4 KB | 24 KB | fine |

Same unbounded-WAL pattern house saw: the central DBs carry constant concurrent read traffic (every
request touches `shared.db`; every log insert touches `logs.db`) + both blue/green containers hold
the files open, so better-sqlite3's PASSIVE auto-checkpoint keeps losing the race to a pinning reader
and the WAL high-water mark ratchets up and never returns. `shared.db`'s WAL being **11× the DB** is
the starkest case. The TRUNCATE-on-a-timer fixes it.

## 2. 📊 Per-dictionary WAL investigation (Task 3 — report only)

**Question:** do the per-dict `dictionaries/<id>.db` (+ their `.history.db`) show the same
unbounded-WAL growth as the central DBs? **Answer: NO.** Per-dict WALs are self-limiting; do **not**
extend the cron to them yet.

### Prod measurement (2026-07-07, `ssh living`, `/opt/hosting/data/dictionaries/`)

- **`river` (the heaviest-write dict — recent API work): 31 MB `.db`, `.db-wal` = 0 bytes.** Fully
  drained. Its `.history.db` is 66 MB with a 64 KB WAL. River is a non-issue.
- **Fleet totals across ~1,588 dictionaries:**
  - content `.db-wal`: **4.45 MB total** across 1,472 files — i.e. essentially all ~0 **except
    `sugtstun`** (1.77 MB db / **4.15 MB wal**, 2.35×), which accounts for nearly the whole total.
  - history `.history.db-wal`: **43.5 MB total** across 27 files — the top ~8 (boienen, sugtstun,
    ewdébe, rhenic, intergermanisch, cormani, milang, orich) each **pinned at ~4.1 MB**.

### Interpretation

The recurring ~4.1 MB ceiling is exactly SQLite's default PASSIVE `wal_autocheckpoint` threshold
(1000 pages × 4 KB ≈ 4.1 MB). The hot per-dict DBs are being **successfully passive-checkpointed** and
capped there — the opposite of the central DBs' unbounded ratchet. The difference is concurrency: a
per-dict DB is only touched when *that* dictionary is synced/read, so a passive checkpoint usually
finds no pinning reader and advances; `shared.db`/`logs.db` are under constant multi-connection
pressure so passive checkpoints perpetually lose the race.

### Blast radius of NOT extending the cron to per-dict DBs

Small and bounded: **~4.5 MB total** content WAL + **~43.5 MB total** history WAL fleet-wide, each
individual WAL capped ~4 MB. Nothing like the 350 MB+ combined central WAL. **No action needed now.**

### Future watch (if it ever changes)

A per-dict content DB *could* start ratcheting like `shared.db` if one gains sustained multi-reader
concurrency — e.g. a very popular public dict served under constant traffic while the snapshot builder
+ both blue/green containers all hold it open. None do today (river, the heaviest, sits at 0). Cheap
future safeguard if that emerges: have the checkpoint sweep also iterate the `dictionaries/` dir
(content + history DBs) — the cron's `run_wal_checkpoint_once({ dbs })` already accepts an explicit
target list, so it's a small extension. Low priority until a per-dict WAL is observed climbing past
its ~4 MB passive cap.
