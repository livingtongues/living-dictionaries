# OPFS leader-worker dict DB (ported from house)

LD's browser per-dictionary DB (`dictionaries/<id>.db`) runs on **OPFS in a leader-elected
dedicated worker** — house's topology, copy-pasted-and-adapted (port guide:
`~/code/house/.knowledge/architecture/leader-worker-port-to-ld.md`). This page records only the
non-obvious decisions + the gotcha that bit us; the code in `src/lib/db/dict-client/` is the
source of truth. Remaining tasks: `.issues/opfs-db-follow-ups.md` (the port-plan issue is deleted —
it landed fully verified 2026-06-10).

## What changed and why

The OLD path (`shared-worker.ts` + `opfs-vfs-loader.ts`, now deleted) tried OPFS inside a
**SharedWorker** and **always fell back to MemoryVFS** — because OPFS `createSyncAccessHandle` is
exposed ONLY in **dedicated** workers, never SharedWorkers. So every dict re-downloaded its
snapshot and re-synced on every page load (no persistence). The new topology elects ONE leader
tab per dict via `navigator.locks`; only the leader spawns a dedicated worker that holds the OPFS
SAH for the session (~1× in-place reads/writes) + runs the sync engine. Followers RPC the leader
over a `BroadcastChannel`. Now the dict DB genuinely persists across reload/restart.

## LD-specific keying (the one design axis vs house)

House keys its single viewer + per-user admin DB by `role`+`user_id`. LD is multi-dictionary, and
**viewer + editor SHARE one OPFS file** (`dictionaries/<id>.db`); an OPFS SAH is exclusive per
file, so there must be exactly **one leader per dictionary**, keyed by **`dict_id` alone**
(`ld-db-<dict_id>` channel, `ld-db-<dict_id>-leader` lock, `ld-db-leader-<dict_id>` worker name).
There is NO role in the harness — the editor capability is **promoted in place** via a `set_role`
RPC (mirrors the old SharedWorker boot+promote). `dict-lifecycle.ts` re-asserts `set_role` on
every leader `ready` so an editor tab re-promotes a viewer-booted leader after a hand-off.

## The WAL-header gotcha (the thing that will re-bite if you forget it)

**The single-file OPFS SAH VFS (`worker/opfs-sah-vfs.js`) can only open a SQLite file with a
rollback-journal header (writer/read version = 1). It CANNOT open a WAL-mode header (version 2)
→ `SQLITE_CANTOPEN`.**

better-sqlite3 `.backup()` **preserves the source's WAL-mode header**, so a snapshot built from a
live WAL-mode server DB is born unopenable by the VFS. This was invisible before the port because
the old SharedWorker path silently fell back to MemoryVFS. Inspect a snapshot's header bytes 18/19
(`writer version`/`read version`); `file snapshot.db` also prints them.

Three layers fix it (all must stay):
1. **Server R2 cron** (`db/server/r2-snapshot-builder.ts`) — `temp_db.pragma('journal_mode = DELETE')`
   on the `.backup()` copy before gzip+upload.
2. **Server editor endpoint** (`routes/api/dictionary/[id]/db/+server.ts`) — same pragma on its
   temp copy (editors fetch their snapshot here, not from R2).
3. **Client** (`dict-client/fetch-snapshot.ts` `normalize_snapshot_header`) — flips header bytes
   18/19 from 2→1 in the downloaded bytes before writing to OPFS. **Safe** because a single-file
   `.backup()` has no `-wal` sidecar, so the WAL flag is cosmetic — flipping it yields the exact
   header `journal_mode=DELETE` produces. This is the defense for **legacy prod R2 snapshots**
   built before fix #1; without it, after cutover every viewer of an un-edited dict falls back to
   MemoryVFS + re-downloads each boot until the cron rebuilds that dict.

**Cutover op note:** a one-time `force_rebuild_snapshot` sweep of all dicts gives smaller, clean
rollback-mode R2 artifacts, but isn't required for correctness thanks to fix #3.

## Post-port review findings (2026-06-11)

- **Transport re-send is epoch-gated.** Pending RPCs are re-posted ONLY when a `ready` carries a NEW
  leader epoch. The leader answers every joining tab's ping with a same-epoch `ready`; re-posting on
  those (the original behavior) double-executed in-flight `exec`s. Fixed identically in both repos —
  the four `dict-client/worker/` harness files are **byte-identical with house; patch both together**.
- **Local dev + `R2_SNAPSHOT_BUILDER_ENABLED=true` pushes LOCAL dict data to the PROD snapshots
  bucket** (`snapshots.livingdictionaries.app`) — there is no dev/prod bucket split. An e2e marker
  reached the prod `nukuoro.db.gz` this way. Keep the flag off in dev (house does); e2e harnesses
  that write MUST be net-zero (`opfs-dict-editor.mjs` now restores + re-pushes its edit).
- **Two latent harness bugs found via the heal e2e (fixed in both repos, 2026-06-11):**
  (1) `open_opfs_connection` leaked the held SAH when a statement failed after `open_v2` (corrupt
  file → file undeletable → recovery impossible); (2) it built a NEW wasm instance per call while a
  module-level set skipped `vfs_register` on it → every SECOND open in a worker failed (broke
  `reset()` + self-heal in both repos). Now: one memoized sqlite3 instance per worker, close-on-fail.
- **The instance self-heals**: corrupt OPFS file → delete + refetch (once); snapshot fetch failure →
  empty DB + migrations + pull-since-null; `snapshot_expired` → auto-`reset()` when no dirty rows
  (editors with un-pushed writes keep their data + get a toast). Re-runnable proof:
  `tools/e2e/opfs-dict-heal.mjs`.
- Remaining accepted/deferred items: `.issues/opfs-db-follow-ups.md`.

## Other decisions worth remembering

- **Op-mutex is load-bearing.** `dict-instance.ts` serializes every `exec` RPC AND the sync
  engine's apply-transaction through one mutex (`DictSyncEngine`'s new `serialize` option), so a
  UI write can never land mid-`BEGIN/COMMIT` of a sync txn (SQLite txns are per-connection — it'd
  silently enrol and roll back). The network round-trip stays outside the lock. Reads don't lock.
- **Whole-op atomicity is NOT gained yet.** `operations.ts` still runs main-thread, issuing several
  `exec` RPCs per logical write. Each is mutex-serialized but the group isn't atomic — identical to
  the pre-OPFS behavior. Moving `operations.ts` worker-side behind a `dict_write` op is a flagged
  follow-up, not part of parity.
- **MemoryVFS fallback kept** (`memory-connection.ts`) for runtimes without OPFS SAH (pre-iOS-17):
  migrations from scratch + pull-since-null, re-fetched every boot. `LeaderMeta.persistent` carries
  this to the main-thread shim's `is_opfs_backed`.
- **opfs-lru held-SAH guard:** eviction skips any dict whose leader Web Lock is held
  (`navigator.locks.query()`), replacing the `open_dict_ids` set the old SharedWorker passed —
  never yank a file out from under a live leader's SAH.
- **Events fan to ALL tabs incl. originator** (no port-exclusion like the old SharedWorker). Extra
  re-query is harmless; Orama `remove_ids` is idempotent.
- **Dev `sqlite-query.sh` still works** — `+layout.ts` registers the `worker-connection` shim with
  `live_share`, so the proxy's SQL runs over the same `query`/`exec` RPC the UI uses.

## Verification harness (re-runnable)

- `tools/e2e/opfs-dict-smoke.mjs` — viewer multi-tab: cold fetch, OPFS persistence across
  reload/restart, read parity, single leader, follower reads via BroadcastChannel, leader hand-off.
- `tools/e2e/opfs-dict-editor.mjs` — editor: write + op-mutex path + cross-tab `tables_changed` +
  follower reads shared leader DB + sync push clears dirty (logs in via dev OTP + `dev_admin_level=2`).
- `tools/bench/opfs-write-amplification.mjs` — proves ~1×: cold snapshot lands 1:1 in OPFS; steady
  in-place edits grow the file by 0. Reads file sizes FROM THE BROWSER (immune to `/proc/diskstats`
  noise — this machine's baseline disk churn made disk-sector measurement useless).
