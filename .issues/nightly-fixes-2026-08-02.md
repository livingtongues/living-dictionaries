# Nightly report fixes — 2026-08-02 batch

Approved by Jacob from the 2026-08-01 overnight fleet reports. Sources:
`.cron/log-reviews/2026-08-01.md` §1.1 + §5, `~/code/horse/.cron/parity-reviews/2026-08-01.md`,
`~/code/horse/.cron/nightly-reviews/2026-08-01.md`.

**All changes UNCOMMITTED — Jacob owns every commit (push = deploy).** The working tree also carries
other lanes' in-flight work (the Mapbox wrapper rename, 27 files; the daytime `monthly-metrics*.ts`
work) — deliberately untouched.

## Items

1. ✅ **House's event-loop stall meter, ported — the INSTRUMENT only.**
   `$lib/server/host-stats.ts` gains `loop_lag_max_ms` + `loop_lag_p99_ms` (node `perf_hooks`
   `monitorEventLoopDelay`), one histogram **per named tracker**, windowed exactly like the existing
   CPU baselines: first read enables + returns null, every later read reports max/p99 since that
   tracker's previous read and resets. Rides the existing 5-min `host_stats` event, so it needed no
   new plumbing. House's forked-child snapshot architecture was deliberately NOT ported (the parity
   lane measured LD doesn't need it — see item 2).
2. ✅ **`gzipSync` off the request thread**, both call sites: `r2-snapshot-builder.ts` and
   `routes/api/dictionary/[id]/db/+server.ts` → `promisify(gzip)` + `readFile`.
3. ✅ **The daily retention sweep runs in the niced child**, exactly like the analytics compute.
   ONE fork does both, sweep first (the order was already load-bearing: the sweep finalizes the
   rollups the analytics payload is built on).
4. ✅ **Media-deletion sweep safety**: a failed dict.db read is now a refusal to answer, not an
   empty in-use set; plus a proportion brake. NOT house's shape.
5. ✅ **`server_started` + a coalesced daily `cron_heartbeat` per cron.**
6. ✅ **Standing rule recorded**: `.knowledge/server/catch-blocks-that-fabricate-state.md`, with
   item 4 as its worked instance.
7. ✅ **Production housekeeping**: the older half of the `shared.db.bak-*` pile deleted on the
   living VPS (557 MiB reclaimed).

## Decisions taken while implementing

### Item 3 — the two non-obvious parts

- **One fork, not two.** The child (`ANALYTICS_SNAPSHOT_SWEEP=1`) runs
  `sweep_log_retention_in_child()` and then the analytics compute. Only the daily cron asks for the
  sweep — the boot catch-up and any manual recompute never do (test-enforced).
- **The child opens its OWN handles** (`new Database(shared.db)` + `open_logs_db` /
  `open_log_archive_db` with a 60 s busy timeout) rather than `get_shared_db()`: the child must not
  run the migration runner, and unlike the serving process it is allowed to wait for a lock.
- 🔶 **The serving process's `logs.db` busy timeout dropped 5000 ms → 250 ms**
  (`SERVING_BUSY_TIMEOUT_MS` in `logs-db.ts`). **This is load-bearing, not tidying.** better-sqlite3
  waits for a lock *synchronously*, so once another process can hold logs.db's write lock for
  minutes (a `VACUUM`), a `/api/log` POST carrying 20 entries would park the request thread for
  100 s — reintroducing the exact freeze the fork removes. A telemetry row is droppable; a frozen
  request thread is not. At ~0.4 rows/s a maintenance window now costs <10% of the loop.
- The parent owns the telemetry write (same rule as the analytics half): `log_retention_swept`
  carries `duration_ms`, `days_rolled`, `archived`, `pruned`, which files were `VACUUM`ed, and
  **per-step wall clock** (`step_ms`) — the number that had to be reconstructed from a proxy log by
  hand on 2026-08-01. Failures emit `log_retention_sweep_failed`; a child that fails to LAUNCH emits
  it too (node fires `error` with no `exit`), and a day skipped by the in-flight guard emits
  `log_retention_sweep_skipped`.
- `run_log_retention_sweep()` is gone (its whole body was "run this on the request thread").
  `run_log_retention_once()` is unchanged in behaviour and still the tested unit.

### Item 4 — why neither repo's code was copied

house's equivalent read is unguarded: a failure throws, the sweep dies, nothing is marked — the right
outcome by accident. Copying it into LD would have produced an uncaught throw with no log line for
the offending dictionary. What landed instead:

- `live_keys_for_dict()` returns `{ ok, keys, dictionary_deleted, error }`. `ok: false` ⇒ log
  `media_sweep_dict_unreadable` (error level) and **skip that dictionary whole**.
- "Gone from the catalog" is a separate, checked state, so genuine reclamation of deleted
  dictionaries still works instead of being sacrificed to safety.
- A **proportion brake** (`orphan_brake_tripped`: >50% of a dictionary's ≥20 objects newly orphaned
  in one sweep) refuses the marking and logs `media_orphan_brake_tripped`. This is what covers the
  failures that never throw — a renamed table, a half-restored file.
- A db with *none* of the three media tables is a failed read (we did not actually read anything).
- `media_sweep_reconciled` is now `warn` when either counter is non-zero — it used to be one `info`
  row where nine numbers looked alike.
- Deliberately unchanged: the deletion path and the 30-day grace.

### Item 5 — shapes chosen

- `server_started` at hooks.server.ts module scope: `{ app_version, container: primary|standby,
  is_standby, node, pid, dev }`. **No `commit`** — nothing in the running container knows it, and
  reading the newest line of `build-commits.log` would make an old container report a commit it was
  never built from (a plausible wrong answer, i.e. exactly what item 6 is about).
- `cron_heartbeat`: one row per cron per **UTC day**, the day CLAIMED in `shared.db` `db_metadata`
  (`cron_heartbeat_day:<name>`) so a container restarting ten times a day still writes one row.
  Carries `runs` / `failures` / `busy_ms` / `since_ms` accumulated since this process's previous
  heartbeat. ~7 rows/day total. Rationale in code: `cron_runs.last_run_at` is overwritten by the next
  run, so a cron that died three weeks ago and one that ran a minute ago leave identical evidence.

## ⚠️ Finding worth broadcasting to house + tutor

**`histogram.reset()` discards the first sample after the reset** (it becomes the new baseline).
Measured on node v24.16.0: `reset()` → immediately block 800 ms → read reports **11 ms**; insert
15 ms of loop turns before the block and it correctly reports **811 ms**. So the natural verification
script ("reset, do the slow thing, read") reports a clean event loop straight through a freeze and
would make you conclude the ported meter is broken. In production it is harmless (reads are 5 minutes
apart), but it needs to be in the sibling repos' heads before someone "verifies" the instrument.
Written up in `.knowledge/server/event-loop-stalls.md`.

## Verification

- `pnpm test` — **2,528 passed / 4 skipped, 336 files** (full suite). `pnpm exec tsc --noEmit` clean;
  `pnpm check` 0 errors; `pnpm lint` clean.
- **New tests**: loop-lag windowing + reset (host-stats, ported from house); the cron child sweeping
  before it computes and its writes really landing in shared.db; a sweep that can't open its
  databases reporting instead of throwing; only the cron asking for a sweep; one heartbeat per cron
  per UTC day incl. across a restart and a day rollover; heartbeat failure counting; and a new
  `media-sweep-cron.test.ts` covering missing/corrupt/shapeless dict dbs, the deleted-dictionary
  carve-out and every brake boundary.
- **Item 2 measured on mustang** (tiled real dictionary bytes to 54 MB, the size of
  `sora-language-project`), 100 ms heartbeat alongside:
  | | wall | heartbeat lateness |
  |---|---:|---:|
  | `readFileSync` + `gzipSync` | 851 / 811 ms | **751 / 711 ms** |
  | `readFile` + `promisify(gzip)` | 894 / 1185 ms | **2 ms** |
- **Item 2 end-to-end**: dev server + dev-auth L3 → `GET /api/dictionary/ponca/db` → 200,
  `content-encoding: gzip`, `x-db-bytes: 8937472`, body gunzips to a valid SQLite file
  (5,257 entries, `journal_mode = delete` header intact for the OPFS VFS).
- **Item 5 end-to-end**: `server_started` row read back out of `.data/logs.db` after a dev boot —
  `{"app_version":"1785637045505","container":"primary","is_standby":false,"node":"24.16.0",…}`.

## Item 7 — the arithmetic, for the record

20 `shared.db.bak-*` files on the living VPS, 2,144,382,976 B (2.00 GiB) = **12.1× the live
`shared.db`** (177,672,192 B). Split by mtime, exactly 10/10 — and the cut falls in a 4-day gap
(2026-07-17 10:15 → 2026-07-21 01:06), so there was no ambiguity to be conservative about.

- **Deleted (older half, 2026-07-03 → 2026-07-17):** 583,970,816 B = **556.9 MiB**.
- **Kept (newer half, 2026-07-21 → 2026-07-29):** 1,560,412,160 B = 1.45 GiB, 10 files.
- Disk 22% → 22% (21 G used, 76 G free). The two tiny `-shm`/`-wal` companions of the kept
  2026-07-27 backup were left alone, as was `shared.db-wal.bak-20260715-025523` (563 KB, different
  prefix, out of scope).

**Open for Jacob (not acted on):** the fleet already ships `/opt/hosting/bin/db-backup`, which takes
a WAL-safe copy *and* prunes to 7 days + the 2 newest (`vps-setup`
`.knowledge/operations/fleet-maintenance.md` §5). LD's pile predates its use. Applying that policy
here would remove 8 more of the 10 kept files — deliberately NOT done, since the instruction was the
half-split. Worth deciding whether LD's ad-hoc backups should adopt the self-expiring tool.

## Not done (out of scope of the approved list)

- No `snapshot_built` event and no extraction of the two duplicated snapshot builders into one
  function (recommended by the parity lane, not in the approved seven).
- No `/admin/health` panel for the loop-lag fields — the instrument is queryable telemetry, and
  house doesn't surface it either.
- The Mapbox wrapper rename and the `monthly-metrics*.ts` daytime work were not touched or committed.
